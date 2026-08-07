import {deflateSync, inflateSync} from "node:zlib";

export type DecodedRgbaPng = {
  width: number;
  height: number;
  pixels: Buffer;
};

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const paeth = (left: number, above: number, upperLeft: number): number => {
  const prediction = left + above - upperLeft;
  const leftDistance = Math.abs(prediction - left);
  const aboveDistance = Math.abs(prediction - above);
  const upperLeftDistance = Math.abs(prediction - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left;
  return aboveDistance <= upperLeftDistance ? above : upperLeft;
};

export const decodeRgbaPng = (bytes: Buffer): DecodedRgbaPng => {
  if (bytes.length < PNG_SIGNATURE.length || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("PNG evidence has an invalid signature.");
  }
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = -1;
  let interlace = -1;
  const imageData: Buffer[] = [];
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > bytes.length) {
      throw new Error(`PNG ${type} chunk leaves file bounds.`);
    }
    const data = bytes.subarray(dataStart, dataEnd);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8]!;
      colorType = data[9]!;
      interlace = data[12]!;
    } else if (type === "IDAT") {
      imageData.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset = dataEnd + 4;
  }
  if (
    width <= 0 ||
    height <= 0 ||
    bitDepth !== 8 ||
    (colorType !== 2 && colorType !== 6) ||
    interlace !== 0 ||
    imageData.length === 0
  ) {
    throw new Error(
      "PNG evidence must be non-interlaced 8-bit RGB or RGBA with image data.",
    );
  }

  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const rowLength = width * bytesPerPixel;
  const inflated = inflateSync(Buffer.concat(imageData));
  if (inflated.length !== height * (rowLength + 1)) {
    throw new Error("PNG inflated byte length does not match its pixel geometry.");
  }
  const decoded = Buffer.alloc(width * height * bytesPerPixel);
  let inputOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[inputOffset++]!;
    const outputRowStart = y * rowLength;
    const priorRowStart = outputRowStart - rowLength;
    for (let x = 0; x < rowLength; x += 1) {
      const raw = inflated[inputOffset++]!;
      const left = x >= bytesPerPixel ? decoded[outputRowStart + x - bytesPerPixel]! : 0;
      const above = y > 0 ? decoded[priorRowStart + x]! : 0;
      const upperLeft = y > 0 && x >= bytesPerPixel
        ? decoded[priorRowStart + x - bytesPerPixel]!
        : 0;
      let reconstructed: number;
      switch (filter) {
        case 0:
          reconstructed = raw;
          break;
        case 1:
          reconstructed = raw + left;
          break;
        case 2:
          reconstructed = raw + above;
          break;
        case 3:
          reconstructed = raw + Math.floor((left + above) / 2);
          break;
        case 4:
          reconstructed = raw + paeth(left, above, upperLeft);
          break;
        default:
          throw new Error(`PNG row ${y} uses unsupported filter ${filter}.`);
      }
      decoded[outputRowStart + x] = reconstructed & 0xff;
    }
  }
  if (bytesPerPixel === 4) return {width, height, pixels: decoded};
  const pixels = Buffer.alloc(width * height * 4);
  for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex += 1) {
    decoded.copy(pixels, pixelIndex * 4, pixelIndex * 3, pixelIndex * 3 + 3);
    pixels[pixelIndex * 4 + 3] = 255;
  }
  return {width, height, pixels};
};

const crcTable = Array.from({length: 256}, (_value, tableIndex) => {
  let current = tableIndex;
  for (let bit = 0; bit < 8; bit += 1) {
    current = (current & 1) !== 0
      ? 0xedb88320 ^ (current >>> 1)
      : current >>> 1;
  }
  return current >>> 0;
});

const crc32 = (bytes: Buffer): number => {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

const pngChunk = (type: string, data: Buffer): Buffer => {
  const typeBytes = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBytes.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length);
  return chunk;
};

export const encodeRgbaPng = ({
  width,
  height,
  pixels,
}: DecodedRgbaPng): Buffer => {
  if (width <= 0 || height <= 0 || pixels.length !== width * height * 4) {
    throw new Error("RGBA PNG encoding requires positive geometry and exactly four bytes per pixel.");
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const rowLength = width * 4;
  const raw = Buffer.alloc(height * (rowLength + 1));
  for (let y = 0; y < height; y += 1) {
    const targetOffset = y * (rowLength + 1);
    raw[targetOffset] = 0;
    pixels.copy(raw, targetOffset + 1, y * rowLength, (y + 1) * rowLength);
  }
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
};
