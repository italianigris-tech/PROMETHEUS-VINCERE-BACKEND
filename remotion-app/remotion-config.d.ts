declare module '@remotion/cli/config' {
  export const Config: {
    setVideoImageFormat(format: 'jpeg' | 'png' | 'none'): void
    setOverwriteOutput(overwrite: boolean): void
    setPixelFormat(format: string): void
  }
}
