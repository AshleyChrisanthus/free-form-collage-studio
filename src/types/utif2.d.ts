declare module 'utif2' {
  export interface IFD {
    width: number;
    height: number;
    data?: Uint8Array;
    [key: string]: unknown;
  }

  export function decode(buffer: ArrayBuffer | ArrayBufferView): IFD[];
  export function decodeImage(buffer: ArrayBuffer | ArrayBufferView, ifd: IFD): void;
  export function toRGBA8(ifd: IFD): Uint8Array;
  export function encodeImage(rgba: Uint8Array, w: number, h: number): ArrayBuffer;
}
