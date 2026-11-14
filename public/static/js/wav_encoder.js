/**
 * AudioBuffer to 16-bit PCM WAV Converter
 * Encodes audio samples into a standard, lossless WAV file format.
 */
function audioBufferToWavBlob(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    
    // Interleave channels
    let interleaved;
    if (numChannels === 2) {
        const left = buffer.getChannelData(0);
        const right = buffer.getChannelData(1);
        interleaved = new Float32Array(left.length + right.length);
        let index = 0;
        let inputIndex = 0;
        while (index < interleaved.length) {
            interleaved[index++] = left[inputIndex];
            interleaved[index++] = right[inputIndex];
            inputIndex++;
        }
    } else {
        interleaved = buffer.getChannelData(0);
    }
    
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = interleaved.length * bytesPerSample;
    const headerSize = 44;
    const totalSize = headerSize + dataSize;
    
    const arrayBuffer = new ArrayBuffer(totalSize);
    const view = new DataView(arrayBuffer);
    
    // Helper to write ASCII strings
    function writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }
    
    // RIFF chunk descriptor
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');
    
    // "fmt " sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, format, true); // AudioFormat (1 = PCM)
    view.setUint16(22, numChannels, true); // NumChannels
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, byteRate, true); // ByteRate
    view.setUint16(32, blockAlign, true); // BlockAlign
    view.setUint16(34, bitDepth, true); // BitsPerSample
    
    // "data" sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);
    
    // Write 16-bit PCM audio samples
    let offset = 44;
    for (let i = 0; i < interleaved.length; i++, offset += 2) {
        // Clamp sample between -1.0 and 1.0
        const s = Math.max(-1, Math.min(1, interleaved[i]));
        // Scale to signed 16-bit integer (-32768 to 32767)
        const sample16 = s < 0 ? s * 0x8000 : s * 0x7FFF;
        view.setInt16(offset, sample16, true);
    }
    
    return new Blob([view], { type: 'audio/wav' });
}

window.audioBufferToWavBlob = audioBufferToWavBlob;
