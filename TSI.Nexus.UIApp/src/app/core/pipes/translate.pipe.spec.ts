import { TranslatePipe } from './translate.pipe';
import { TranslationService } from '../services/translation/translation.service';

describe('TranslatePipe', () => {
  let translationServiceMock: { instant: ReturnType<typeof vi.fn> };
  let pipe: TranslatePipe;

  beforeEach(() => {
    translationServiceMock = { instant: vi.fn().mockReturnValue('translated value') };
    pipe = new TranslatePipe(translationServiceMock as unknown as TranslationService);
  });

  it('returns an empty string for null/undefined/empty key without calling the service', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
    expect(pipe.transform('')).toBe('');
    expect(translationServiceMock.instant).not.toHaveBeenCalled();
  });

  it('delegates to TranslationService.instant with the key', () => {
    const result = pipe.transform('SOME.KEY');

    expect(translationServiceMock.instant).toHaveBeenCalledWith('SOME.KEY', undefined);
    expect(result).toBe('translated value');
  });

  it('forwards interpolation params to TranslationService.instant', () => {
    pipe.transform('SOME.KEY', { name: 'Ana' });

    expect(translationServiceMock.instant).toHaveBeenCalledWith('SOME.KEY', { name: 'Ana' });
  });
});
