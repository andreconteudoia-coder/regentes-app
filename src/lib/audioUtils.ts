export const audioBufferToWav = (buffer: AudioBuffer): Blob => {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArray = new ArrayBuffer(length);
  const view = new DataView(bufferArray);
  const channels = [];
  let sample = 0;
  let offset = 0;
  let pos = 0;

  const setUint16 = (data: number) => {
    view.setUint16(pos, data, true);
    pos += 2;
  };

  const setUint32 = (data: number) => {
    view.setUint32(pos, data, true);
    pos += 4;
  };

  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit

  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length

  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (pos < length) {
    for (let i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale to 16-bit signed int
      view.setInt16(pos, sample, true); // write 16-bit sample
      pos += 2;
    }
    offset++; // next source sample
  }

  return new Blob([bufferArray], { type: 'audio/wav' });
};

export const processVoiceTrack = async (audioBuffer: AudioBuffer, voiceType: 'S' | 'A' | 'T' | 'B'): Promise<Blob> => {
  const offlineCtx = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate
  );

  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;

  const filter = offlineCtx.createBiquadFilter();

  // Basic EQ simulation for voices to isolate frequency ranges
  switch (voiceType) {
    case 'S': // Soprano: High frequencies
      filter.type = 'highpass';
      filter.frequency.value = 800;
      break;
    case 'A': // Contralto: Mid-high frequencies
      filter.type = 'bandpass';
      filter.frequency.value = 600;
      filter.Q.value = 1.5;
      break;
    case 'T': // Tenor: Mid-low frequencies
      filter.type = 'bandpass';
      filter.frequency.value = 300;
      filter.Q.value = 1.5;
      break;
    case 'B': // Bass: Low frequencies
      filter.type = 'lowpass';
      filter.frequency.value = 200;
      break;
  }

  source.connect(filter);
  filter.connect(offlineCtx.destination);
  source.start(0);

  const renderedBuffer = await offlineCtx.startRendering();
  return audioBufferToWav(renderedBuffer);
};
