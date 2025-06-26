import { createFFmpeg, fetchFile } from './ffmpeg/ffmpeg.min.js';

// Variabile globale ffmpeg
const ffmpeg = createFFmpeg({
  log: true,
  corePath: './ffmpeg/ffmpeg-core.js',
  workerPath: './ffmpeg/ffmpeg-core.worker.js',
});

async function loadFFmpeg() {
  if (!ffmpeg.isLoaded()) {
    await ffmpeg.load();
  }
}

async function convertToMP3(file) {
  try {
    await loadFFmpeg();

    const inputName = 'input_' + Math.random().toString(36).substring(2);
    await ffmpeg.FS('writeFile', inputName, await fetchFile(file));

    await ffmpeg.run(
      '-i', inputName,
      '-vn',
      '-ar', '44100',
      '-ac', '2',
      '-b:a', '192k',
      '-y',
      'output.mp3'
    );

    const data = ffmpeg.FS('readFile', 'output.mp3');

    // Pulizia
    ffmpeg.FS('unlink', inputName);
    ffmpeg.FS('unlink', 'output.mp3');

    return data;
  } catch (error) {
    console.error('Errore conversione FFmpeg:', error);
    throw error;
  }
}

// --- Funzioni per MIDI (usa MIDIfw come nel tuo esempio)

function createSimpleMidi(durationSeconds) {
  const bpm = 120;
  const ticksPerBeat = 96;
  const ticksPerSecond = ticksPerBeat / (60 / bpm);
  const totalTicks = Math.round(durationSeconds * ticksPerSecond);

  const track = MIDIfw.createTrack();

  const note1Start = 0;
  const note2Start = 0;
  const noteDuration = totalTicks;

  track.noteOn({ time: note1Start, note: 'C4', velocity: 100 });
  track.noteOff({ time: noteDuration, note: 'C4' });

  track.noteOn({ time: note2Start, note: 'E4', velocity: 100 });
  track.noteOff({ time: noteDuration, note: 'E4' });

  const midiFile = MIDIfw.createFile({
    ticksPerBeat,
    tempo: bpm,
  });

  midiFile.addTrack(track);

  return midiFile.getBytes();
}

// Mostra/nascondi upload MIDI personalizzato
document.querySelectorAll('input[name="midi-type"]').forEach(radio => {
  radio.addEventListener('change', function() {
    document.getElementById('midi-file').style.display =
      this.value === 'custom' ? 'block' : 'none';
  });
});

const generateBtn = document.getElementById("generate");

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

  // Conversione audio in MP3 (se serve)
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

  // Durata audio e creazione MIDI automatico
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

  // Crea ZIP
  const zip = new JSZip();
  const folder = zip.folder(modName);

  folder.file(`${modName}.mp3`, mp3Data);

  const imgExt = imageFile.type.split('/')[1];
  const imgData = new Uint8Array(await imageFile.arrayBuffer());
  folder.file(`${modName}.${imgExt}`, imgData);

  folder.file(`${modName}.mid`, midiData);

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

// Carica ffmpeg all'inizio per velocizzare
loadFFmpeg();
