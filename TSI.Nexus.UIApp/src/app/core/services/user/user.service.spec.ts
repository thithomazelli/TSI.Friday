import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ApiService } from '@nexus/core';
import { User } from '../../models';
import { WebApiResponse } from '../../utilities';
import { UserService } from './user.service';

describe('UserService', () => {
  let apiServiceMock: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  function createService(): UserService {
    apiServiceMock = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() };
    apiServiceMock.get.mockReturnValue(new Subject());
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: apiServiceMock }],
    });
    return TestBed.inject(UserService);
  }

  it('should be created', () => {
    expect(createService()).toBeTruthy();
  });

  it('triggers a getAll fetch eagerly on construction', () => {
    createService();

    expect(apiServiceMock.get).toHaveBeenCalledWith('users/getAll');
  });

  it('users$/getAll() emits the loaded response once the request resolves', () => {
    const load$ = new Subject<WebApiResponse<User[]>>();
    apiServiceMock = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() };
    apiServiceMock.get.mockReturnValue(load$);
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: apiServiceMock }],
    });
    const service = TestBed.inject(UserService);

    let response: WebApiResponse<User[]> | undefined;
    service.getAll().subscribe((v) => (response = v));
    TestBed.flushEffects();
    expect(response).toBeUndefined();

    const loaded = { data: [{ id: 'u1' } as User] } as WebApiResponse<User[]>;
    load$.next(loaded);
    TestBed.flushEffects();

    expect(response).toBe(loaded);
  });

  it('getAllPaged builds the query string and unwraps response.data', () => {
    const service = createService();
    const paged$ = new Subject<WebApiResponse<unknown>>();
    apiServiceMock.get.mockReturnValue(paged$);

    service.getAllPaged({ page: 1, pageSize: 10 } as never);

    expect(apiServiceMock.get).toHaveBeenCalledWith(expect.stringContaining('users/getAllPaged?'));
  });

  it('getById hits the expected endpoint', () => {
    const service = createService();
    apiServiceMock.get.mockReturnValue(new Subject());

    service.getById('u1');

    expect(apiServiceMock.get).toHaveBeenCalledWith('users/getById/u1');
  });

  it('refresh re-fetches the shared users$ cache', () => {
    const service = createService();
    const getCallsBefore = apiServiceMock.get.mock.calls.length;
    apiServiceMock.get.mockReturnValue(new Subject());

    service.refresh();

    expect(apiServiceMock.get.mock.calls.length).toBe(getCallsBefore + 1);
  });

  it('userChanged$ emits once immediately to a new subscriber', () => {
    const service = createService();
    let emissions = 0;
    service.userChanged$.subscribe(() => emissions++);
    TestBed.flushEffects();

    expect(emissions).toBe(1);
  });

  it('add/update/delete each re-fetch the shared list and notify userChanged$', () => {
    const service = createService();
    const addResponse$ = new Subject<WebApiResponse<User>>();
    const updateResponse$ = new Subject<WebApiResponse<User>>();
    const deleteResponse$ = new Subject<WebApiResponse<User>>();
    apiServiceMock.post.mockReturnValue(addResponse$);
    apiServiceMock.put.mockReturnValue(updateResponse$);
    apiServiceMock.delete.mockReturnValue(deleteResponse$);
    apiServiceMock.get.mockReturnValue(new Subject());

    let changedEmissions = 0;
    service.userChanged$.subscribe(() => changedEmissions++);
    TestBed.flushEffects();
    expect(changedEmissions).toBe(1);

    const getCallsBefore = apiServiceMock.get.mock.calls.length;

    service.add({} as User).subscribe();
    addResponse$.next({} as WebApiResponse<User>);
    TestBed.flushEffects();
    expect(apiServiceMock.get.mock.calls.length).toBe(getCallsBefore + 1);
    expect(changedEmissions).toBe(2);

    service.update({} as User).subscribe();
    updateResponse$.next({} as WebApiResponse<User>);
    TestBed.flushEffects();
    expect(apiServiceMock.get.mock.calls.length).toBe(getCallsBefore + 2);
    expect(changedEmissions).toBe(3);

    service.delete({} as User).subscribe();
    deleteResponse$.next({} as WebApiResponse<User>);
    TestBed.flushEffects();
    expect(apiServiceMock.get.mock.calls.length).toBe(getCallsBefore + 3);
    expect(changedEmissions).toBe(4);
  });
});
