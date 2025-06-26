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

// Show/hide custom MIDI upload input
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
    alert("Please enter a mod name.");
    return;
  }

  if (!audioFile) {
    alert("Please select an audio file.");
    return;
  }

  if (!imageFile) {
    alert("Please select a cover image.");
    return;
  }

  if (!["image/jpeg", "image/png"].includes(imageFile.type)) {
    alert("Only JPG or PNG images are supported.");
    return;
  }

  // Read audio as Uint8Array (no conversion)
  const mp3Data = new Uint8Array(await audioFile.arrayBuffer());

  // Get audio duration and create MIDI automatically if needed
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
        alert("Error creating MIDI file.");
        return;
      }
    } catch (e) {
      alert("Error calculating audio duration: " + e.message);
      return;
    }
  } else {
    if (!customMidiFile) {
      alert("Please select a custom MIDI file.");
      return;
    }
    midiData = new Uint8Array(await customMidiFile.arrayBuffer());
  }

  // Create ZIP
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
    generateBtn.textContent = "Creating archive...";
    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(content);
    link.download = `${modName}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  } catch (e) {
    alert("Error creating ZIP archive: " + e.message);
  } finally {
    generateBtn.textContent = "Generate ZIP";
    generateBtn.disabled = false;
  }
});
