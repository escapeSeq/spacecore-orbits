import {
  buildAnimatedSvg,
  SVG_ANIMATION_DURATION_SEC,
  SVG_ANIMATION_FPS,
  SVG_ANIMATION_FRAME_COUNT,
} from './sceneExport';

describe('sceneExport animated SVG', () => {
  test('uses frame defs to avoid semicolons in SMIL values', () => {
    const frames = [
      'data:image/jpeg;base64,AAA',
      'data:image/jpeg;base64,BBB',
    ];
    const svg = buildAnimatedSvg(frames, 640, 480, '#010203', 10);

    expect(SVG_ANIMATION_FRAME_COUNT).toBe(200);
    expect(SVG_ANIMATION_DURATION_SEC).toBe(10);
    expect(SVG_ANIMATION_FPS).toBe(20);
    expect(svg).toContain('id="frame-0"');
    expect(svg).toContain('id="frame-1"');
    expect(svg).toContain('values="#frame-0;#frame-1"');
    expect(svg).toContain('dur="10s"');
    expect(svg).toContain('calcMode="discrete"');
    expect(svg).not.toContain('values="data:image/jpeg;base64,AAA');
  });
});
