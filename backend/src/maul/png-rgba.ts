import {inflateSync} from "node:zlib";

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
    colorType !== 6 ||
    interlace !== 0 ||
    imageData.length === 0
  ) {
    throw new Error(
      "PNG evidence must be non-interlaced 8-bit RGBA with image data.",
    );
  }

  const bytesPerPixel = 4;
  const rowLength = width * bytesPerPixel;
  const inflated = inflateSync(Buffer.concat(imageData));
  if (inflated.length !== height * (rowLength + 1)) {
    throw new Error("PNG inflated byte length does not match its RGBA geometry.");
  }
  const pixels = Buffer.alloc(width * height * bytesPerPixel);
  let inputOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[inputOffset++]!;
    const outputRowStart = y * rowLength;
    const priorRowStart = outputRowStart - rowLength;
    for (let x = 0; x < rowLength; x += 1) {
      const raw = inflated[inputOffset++]!;
      const left = x >= bytesPerPixel ? pixels[outputRowStart + x - bytesPerPixel]! : 0;
      const above = y > 0 ? pixels[priorRowStart + x]! : 0;
      const upperLeft = y > 0 && x >= bytesPerPixel
        ? pixels[priorRowStart + x - bytesPerPixel]!
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
      pixels[outputRowStart + x] = reconstructed & 0xff;
    }
  }
  return {width, height, pixels};
};
