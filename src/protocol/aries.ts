/**
 * ARIES packet framing layer.
 *
 * Wire format — CONFIRMED by RE of COMMEG32.DLL:
 *
 *   Bytes [0-3]   uint32 LE  message type
 *   Bytes [4-7]   uint32 LE  "tag" (timer/sequence; 0 in most sent packets)
 *   Bytes [8-11]  uint32 LE  payload length (bytes following this header)
 *   Bytes [12...] payload
 *
 * Key functions in COMMEG32.DLL:
 *   FUN_10003600  — initialises outgoing packet (writes type + 12-byte header)
 *   FUN_10003680  — finalises header (fills payload length field at [8-11])
 *   FUN_100036d0  — recv-side parser (validates header, extracts type + payload)
 */

export interface Packet {
  /** Packet type field (bytes [0-3] LE). */
  type: number;
  /** Tag field (bytes [4-7] LE). */
  tag: number;
  /** Payload bytes (after the 12-byte header). */
  payload: Buffer;
  /** Byte offset in the stream where this packet's header started. */
  streamOffset: number;
}

/** Size of the fixed packet header. */
export const HEADER_SIZE = 12;

/**
 * Build an outgoing ARIES packet.
 *
 * @param type     Message type (uint32 LE)
 * @param payload  Payload bytes (after the header); may be empty
 * @param tag      Optional tag field (default 0)
 */
export function buildPacket(type: number, payload: Buffer, tag = 0): Buffer {
  const hdr = Buffer.allocUnsafe(HEADER_SIZE);
  hdr.writeUInt32LE(type, 0);
  hdr.writeUInt32LE(tag, 4);
  hdr.writeUInt32LE(payload.length, 8);
  return Buffer.concat([hdr, payload]);
}

/**
 * Stateful stream parser for a single client connection.
 *
 * Accumulates raw TCP data and emits complete Packet objects as they arrive.
 * Handles TCP fragmentation and coalescing transparently.
 */
export class PacketParser {
  private buf: Buffer = Buffer.alloc(0);
  private streamOffset = 0;

  /**
   * Feed raw bytes from the socket into the parser.
   * Returns all complete packets that can be extracted from the accumulated buffer.
   */
  push(data: Buffer): Packet[] {
    this.buf = Buffer.concat([this.buf, data]);
    const packets: Packet[] = [];

    while (this.buf.length >= HEADER_SIZE) {
      const type        = this.buf.readUInt32LE(0);
      const tag         = this.buf.readUInt32LE(4);
      const payloadLen  = this.buf.readUInt32LE(8);

      // Sanity-check the payload length before allocating.
      // 256 KB is a generous upper bound; if exceeded it's almost certainly
      // a framing error or garbage data.
      if (payloadLen > 256 * 1024) {
        // Log the bad header and discard the buffer.
        const bad = this.buf.subarray(0, Math.min(32, this.buf.length));
        process.stderr.write(
          `[aries] framing error: impossible payload_len=0x${payloadLen.toString(16)} ` +
          `at stream+${this.streamOffset}, dropping connection data\n` +
          `  header bytes: ${bad.toString('hex')}\n`,
        );
        this.buf = Buffer.alloc(0);
        break;
      }

      const totalLen = HEADER_SIZE + payloadLen;
      if (this.buf.length < totalLen) break; // wait for more data

      packets.push({
        type,
        tag,
        payload: Buffer.from(this.buf.subarray(HEADER_SIZE, totalLen)),
        streamOffset: this.streamOffset,
      });

      this.streamOffset += totalLen;
      this.buf = this.buf.subarray(totalLen);
    }

    return packets;
  }

  reset(): void {
    this.buf = Buffer.alloc(0);
    this.streamOffset = 0;
  }
}

/**
 * Format a buffer as a hex + ASCII dump (like Wireshark / xxd).
 * Used for logging captured packets.
 */
export function hexDump(buf: Buffer, bytesPerRow = 16): string {
  const lines: string[] = [];
  for (let i = 0; i < buf.length; i += bytesPerRow) {
    const slice = buf.subarray(i, i + bytesPerRow);
    const offset = i.toString(16).padStart(8, '0');
    const hex = Array.from(slice)
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ')
      .padEnd(bytesPerRow * 3 - 1, ' ');
    const ascii = Array.from(slice)
      .map(b => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.'))
      .join('');
    lines.push(`${offset}  ${hex}  |${ascii}|`);
  }
  return lines.join('\n');
}
