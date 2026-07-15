import { describe, expect, it } from 'vitest';
import { getCardActionPreviewStyle } from './cardPresentation';

describe('card action preview presentation', () => {
  it('maps deck robots to their forward-facing arena animation rows', () => {
    expect(getCardActionPreviewStyle('zip')).toMatchObject({
      backgroundPosition: '60% 0%',
      backgroundSize: '600% 900%',
    });
    expect(getCardActionPreviewStyle('pulse')).toMatchObject({
      backgroundPosition: '60% 50%',
      backgroundSize: '600% 900%',
    });
    expect(String(getCardActionPreviewStyle('zip').backgroundImage)).toContain(
      'arena-robot-move-sprites.webp',
    );
  });

  it('uses the dedicated vault atlas for vault robots', () => {
    const style = getCardActionPreviewStyle('aegis');
    expect(style).toMatchObject({
      backgroundPosition: '60% 0%',
      backgroundSize: '600% 300%',
    });
    expect(String(style.backgroundImage)).toContain('vault-unit-sprites.webp');
  });
});
