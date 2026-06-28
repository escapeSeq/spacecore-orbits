import {
  buildAnimatedSvg,
  SVG_ANIMATION_DURATION_SEC,
  SVG_ANIMATION_FPS,
  SVG_ANIMATION_FRAME_COUNT,
} from './sceneExport';

describe('sceneExport animated SVG', () => {
  test('uses stacked images with SMIL set timing for each frame', () => {
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
    expect(svg).toContain('begin="0.0000s"');
    expect(svg).toContain('begin="5.0000s"');
    expect(svg).toContain('attributeName="opacity"');
    expect(svg).not.toContain('attributeName="href"');
  });
});
