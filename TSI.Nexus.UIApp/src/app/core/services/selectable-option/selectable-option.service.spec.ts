import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ApiService, WebApiResponse } from '@nexus/core';
import { SelectableOption } from '../../models/selectable-option.model';
import { SelectableOptionGroup } from '../../enums/selectable-option-group.enum';
import { SelectableOptionService } from './selectable-option.service';

describe('SelectableOptionService', () => {
  let apiServiceMock: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  function createService(): SelectableOptionService {
    apiServiceMock = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: apiServiceMock }],
    });
    return TestBed.inject(SelectableOptionService);
  }

  it('should create', () => {
    expect(createService()).toBeTruthy();
  });

  it('getAll hits the expected endpoint (not cached)', () => {
    const service = createService();
    apiServiceMock.get.mockReturnValue(new Subject());

    service.getAll();
    service.getAll();

    expect(apiServiceMock.get).toHaveBeenCalledWith('selectableoptions/getAll');
    expect(apiServiceMock.get).toHaveBeenCalledTimes(2);
  });

  it('getByGroup caches per group - a second call for the same group does not re-fetch', () => {
    const service = createService();
    apiServiceMock.get.mockReturnValue(new Subject());

    service.getByGroup(SelectableOptionGroup.AddressType);
    service.getByGroup(SelectableOptionGroup.AddressType);

    expect(apiServiceMock.get).toHaveBeenCalledWith(
      `selectableoptions/getByGroup/${SelectableOptionGroup.AddressType}`,
    );
    expect(apiServiceMock.get).toHaveBeenCalledTimes(1);
  });

  it('getByGroup caches separately per group', () => {
    const service = createService();
    apiServiceMock.get.mockReturnValue(new Subject());

    service.getByGroup(SelectableOptionGroup.AddressType);
    service.getByGroup(SelectableOptionGroup.EventType);

    expect(apiServiceMock.get).toHaveBeenCalledTimes(2);
  });

  it('getByGroup emits the loaded response once the request resolves', () => {
    const load$ = new Subject<WebApiResponse<SelectableOption[]>>();
    apiServiceMock = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() };
    apiServiceMock.get.mockReturnValue(load$);
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: apiServiceMock }],
    });
    const service = TestBed.inject(SelectableOptionService);

    let response: WebApiResponse<SelectableOption[]> | undefined;
    service.getByGroup(SelectableOptionGroup.AddressType).subscribe((v) => (response = v));
    TestBed.flushEffects();
    expect(response).toBeUndefined();

    const loaded = { data: [{ id: 'o1' } as SelectableOption] } as WebApiResponse<
      SelectableOption[]
    >;
    load$.next(loaded);
    TestBed.flushEffects();

    expect(response).toBe(loaded);
  });

  it('getByGroup completes after its single emission (forkJoin compatibility)', () => {
    const load$ = new Subject<WebApiResponse<SelectableOption[]>>();
    apiServiceMock = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() };
    apiServiceMock.get.mockReturnValue(load$);
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: apiServiceMock }],
    });
    const service = TestBed.inject(SelectableOptionService);

    let completed = false;
    service
      .getByGroup(SelectableOptionGroup.AddressType)
      .subscribe({ complete: () => (completed = true) });
    TestBed.flushEffects();
    expect(completed).toBe(false);

    load$.next({ data: [] } as unknown as WebApiResponse<SelectableOption[]>);
    TestBed.flushEffects();

    expect(completed).toBe(true);
  });

  it('add/update/remove each clear the per-group cache so the next getByGroup re-fetches', () => {
    const service = createService();
    const addResponse$ = new Subject<WebApiResponse<SelectableOption>>();
    const updateResponse$ = new Subject<WebApiResponse<SelectableOption>>();
    const removeResponse$ = new Subject<WebApiResponse<SelectableOption>>();
    apiServiceMock.post.mockReturnValue(addResponse$);
    apiServiceMock.put.mockReturnValue(updateResponse$);
    apiServiceMock.delete.mockReturnValue(removeResponse$);
    apiServiceMock.get.mockReturnValue(new Subject());

    service.getByGroup(SelectableOptionGroup.AddressType);
    const getCallsAfterFirstFetch = apiServiceMock.get.mock.calls.length;

    service.add({} as SelectableOption).subscribe();
    addResponse$.next({} as WebApiResponse<SelectableOption>);
    service.getByGroup(SelectableOptionGroup.AddressType);
    expect(apiServiceMock.get.mock.calls.length).toBe(getCallsAfterFirstFetch + 1);

    service.update({} as SelectableOption).subscribe();
    updateResponse$.next({} as WebApiResponse<SelectableOption>);
    service.getByGroup(SelectableOptionGroup.AddressType);
    expect(apiServiceMock.get.mock.calls.length).toBe(getCallsAfterFirstFetch + 2);

    service.remove({} as SelectableOption).subscribe();
    removeResponse$.next({} as WebApiResponse<SelectableOption>);
    service.getByGroup(SelectableOptionGroup.AddressType);
    expect(apiServiceMock.get.mock.calls.length).toBe(getCallsAfterFirstFetch + 3);
  });
});
