const { createFFmpeg, fetchFile } = FFmpeg;

const ffmpeg = createFFmpeg({
  log: true,
  corePath: './ffmpeg-core/ffmpeg-core.js',
  workerPath: './ffmpeg-core/ffmpeg-core.worker.js'
});


const generateBtn = document.getElementById("generate");

async function convertToMP3(file) {
  try {
    if (!ffmpeg.isLoaded()) {
      await ffmpeg.load();
    }
    
    // Scrivi il file nell'FS di FFmpeg
    const inputName = 'input_' + Math.random().toString(36).substring(2);
    await ffmpeg.FS('writeFile', inputName, await fetchFile(file));
    
    // Esegui la conversione
    await ffmpeg.run(
      '-i', inputName, 
      '-vn',           // No video
      '-ar', '44100',  // Frequenza campionamento
      '-ac', '2',      // Canali stereo
      '-b:a', '192k',  // Bitrate audio
      '-y',            // Sovrascrivi senza chiedere
      'output.mp3'
    );
    
    // Leggi il risultato
    const data = ffmpeg.FS('readFile', 'output.mp3');
    
    // Pulisci i file temporanei
    ffmpeg.FS('unlink', inputName);
    ffmpeg.FS('unlink', 'output.mp3');
    
    return data;
  } catch (error) {
    console.error('Errore conversione FFmpeg:', error);
    throw error;
  }
}

function createSimpleMidi(durationSeconds) {
  // Calcoliamo il tempo in base alla durata (120 BPM per default)
  const bpm = 120;
  const ticksPerBeat = 96;
  const ticksPerSecond = ticksPerBeat / (60 / bpm);
  const totalTicks = Math.round(durationSeconds * ticksPerSecond);
  
  // Creiamo la traccia MIDI
  const track = MIDIfw.createTrack();
  
  // Aggiungiamo le due note lunghe (C4 e E4)
  const note1Start = 0;
  const note2Start = 0;
  const noteDuration = totalTicks;
  
  // Nota 1 (C4)
  track.noteOn({ time: note1Start, note: 'C4', velocity: 100 });
  track.noteOff({ time: noteDuration, note: 'C4' });
  
  // Nota 2 (E4)
  track.noteOn({ time: note2Start, note: 'E4', velocity: 100 });
  track.noteOff({ time: noteDuration, note: 'E4' });
  
  // Creiamo il file MIDI
  const midiFile = MIDIfw.createFile({
    ticksPerBeat: ticksPerBeat,
    tempo: bpm
  });
  
  midiFile.addTrack(track);
  
  return midiFile.getBytes();
}

// Gestione selezione MIDI
document.querySelectorAll('input[name="midi-type"]').forEach(radio => {
  radio.addEventListener('change', function() {
    document.getElementById('midi-file').style.display = 
      this.value === 'custom' ? 'block' : 'none';
  });
});

generateBtn.addEventListener("click", async () => {
  const modName = (document.getElementById("mod-name").value || "").trim();
  const audioFile = document.getElementById("audio").files?.[0];
  const imageFile = document.getElementById("image").files?.[0];
  const midiType = document.querySelector('input[name="midi-type"]:checked').value;
  const customMidiFile = document.getElementById("midi-file").files?.[0];

  if (!modName) {
    alert("Inserisci un nome per la mod.");
    return;
  }
  
  if (!audioFile) {
    alert("Seleziona un file audio.");
    return;
  }

  if (!imageFile) {
    alert("Seleziona un'immagine di copertina.");
    return;
  }

  if (!["image/jpeg", "image/png"].includes(imageFile.type)) {
    alert("Solo immagini JPG o PNG supportate.");
    return;
  }

  // Converti audio a mp3 se necessario
  let mp3Data;
  if (audioFile.type === "audio/mpeg") {
    mp3Data = new Uint8Array(await audioFile.arrayBuffer());
  } else {
    try {
      generateBtn.disabled = true;
      generateBtn.textContent = "Conversione audio in corso...";
      mp3Data = await convertToMP3(audioFile);
      generateBtn.textContent = "Genera ZIP";
      generateBtn.disabled = false;
    } catch (e) {
      alert("Errore nella conversione audio: " + e.message);
      generateBtn.textContent = "Genera ZIP";
      generateBtn.disabled = false;
      return;
    }
  }

  // Ottieni la durata dell'audio (solo se serve generare il MIDI)
  let audioDuration;
  let midiData;
  
  if (midiType === 'auto') {
    try {
      audioDuration = await new Promise((resolve, reject) => {
        const audio = new Audio(URL.createObjectURL(audioFile));
        audio.addEventListener('loadedmetadata', () => {
          resolve(audio.duration);
          URL.revokeObjectURL(audio.src);
        });
        audio.addEventListener('error', (e) => {
          reject(e);
          URL.revokeObjectURL(audio.src);
        });
      });
      
      // Crea il MIDI automatico
      midiData = createSimpleMidi(audioDuration);
      if (!midiData) {
        alert("Errore nella creazione del file MIDI.");
        return;
      }
    } catch (e) {
      alert("Errore nel calcolo della durata audio: " + e.message);
      return;
    }
  } else {
    if (!customMidiFile) {
      alert("Seleziona un file MIDI personalizzato.");
      return;
    }
    midiData = new Uint8Array(await customMidiFile.arrayBuffer());
  }

  // Prepara il file ZIP
  const zip = new JSZip();
  const folder = zip.folder(modName);

  // Aggiungi MP3
  folder.file(`${modName}.mp3`, mp3Data);

  // Aggiungi immagine
  const imgExt = imageFile.type.split('/')[1];
  const imgData = new Uint8Array(await imageFile.arrayBuffer());
  folder.file(`${modName}.${imgExt}`, imgData);

  // Aggiungi MIDI
  folder.file(`${modName}.mid`, midiData);

  // Aggiungi metadati
  const metadata = {
    order: (document.getElementById("order").value || "0").trim(),
    difficulty: (document.getElementById("difficulty").value || "Normal").trim(),
    description: (document.getElementById("description").value || "").trim(),
    composer: (document.getElementById("composer").value || "Unknown").trim(),
    volume: (document.getElementById("volume").value || "0").trim(),
  };
  
  const formattedMeta = Object.entries(metadata)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  
  folder.file(`${modName}.txt`, formattedMeta);

  // Genera e scarica il ZIP
  try {
    generateBtn.textContent = "Creazione archivio...";
    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(content);
    link.download = `${modName}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  } catch (e) {
    alert("Errore nella creazione dell'archivio: " + e.message);
  } finally {
    generateBtn.textContent = "Genera ZIP";
    generateBtn.disabled = false;
  }
});
