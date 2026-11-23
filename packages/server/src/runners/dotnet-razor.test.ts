// Unit tests for early dotnet watch build failure detection.
import { describe, expect, it } from 'vitest';

import { cleanDotnetOutput, detectDotnetBuildFailure } from './dotnet-razor.ts';

describe('detectDotnetBuildFailure', () => {
  it('returns undefined for normal startup output and compiler warnings', () => {
    expect(detectDotnetBuildFailure('')).toBeUndefined();
    expect(
      detectDotnetBuildFailure(
        "dotnet watch 🚀 Hot reload enabled.\nProgram.cs(5,1): warning CS0168: The variable 'x' is declared but never used\nBuild succeeded.",
      ),
    ).toBeUndefined();
  });

  it('detects Build FAILED. and dotnet watch waiting state even with ANSI color codes', () => {
    const ansiError =
      '\u001b[31mServices/BankService.cs(8,84): error CS0535: does not implement interface\u001b[0m\n\u001b[31mBuild FAILED.\u001b[0m';
    expect(detectDotnetBuildFailure(ansiError)).toBe('failed');
    expect(cleanDotnetOutput(ansiError)).toBe(
      'Services/BankService.cs(8,84): error CS0535: does not implement interface\nBuild FAILED.',
    );

    const waiting = `${ansiError}\n❌ Waiting for a file to change before restarting dotnet...`;
    expect(detectDotnetBuildFailure(waiting)).toBe('waiting');
  });
});
