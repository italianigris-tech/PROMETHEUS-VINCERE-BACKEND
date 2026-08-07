import {deflateSync} from "node:zlib";

import {describe, expect, it} from "vitest";

import {decodeRgbaPng, encodeRgbaPng} from "./png-rgba.js";

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const crcTable = Array.from({length: 256}, (_value, tableIndex) => {
  let current = tableIndex;
  for (let bit = 0; bit < 8; bit += 1) {
    current = (current & 1) !== 0
      ? 0xedb88320 ^ (current >>> 1)
      : current >>> 1;
  }
  return current >>> 0;
});

const chunk = (type: string, data: Buffer): Buffer => {
  const typeBytes = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBytes, data]);
  let crc = 0xffffffff;
  for (const byte of body) crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  const result = Buffer.alloc(12 + data.length);
  result.writeUInt32BE(data.length, 0);
  body.copy(result, 4);
  result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 8 + data.length);
  return result;
};

const encodeRgbPng = (pixels: Buffer): Buffer => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(2, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.concat([Buffer.from([0]), pixels]);
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
};

describe("PNG RGBA normalization", () => {
  it("normalizes non-interlaced 8-bit RGB evidence to opaque RGBA", () => {
    const decoded = decodeRgbaPng(
      encodeRgbPng(Buffer.from([255, 0, 0, 0, 128, 255])),
    );

    expect(decoded).toEqual({
      width: 2,
      height: 1,
      pixels: Buffer.from([255, 0, 0, 255, 0, 128, 255, 255]),
    });
  });

  it("continues to decode RGBA evidence", () => {
    const pixels = Buffer.from([10, 20, 30, 40]);
    expect(decodeRgbaPng(encodeRgbaPng({width: 1, height: 1, pixels}))).toEqual({
      width: 1,
      height: 1,
      pixels,
    });
  });
});
