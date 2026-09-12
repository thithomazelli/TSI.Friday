import { of } from 'rxjs';
import { User, UserService } from '@nexus/core';
import { AuditTabComponent } from './audit-tab.component';

describe('AuditTabComponent', () => {
  let userServiceMock: { getById: ReturnType<typeof vi.fn> };
  let component: AuditTabComponent;

  beforeEach(() => {
    userServiceMock = { getById: vi.fn() };
    component = new AuditTabComponent(userServiceMock as unknown as UserService);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('does nothing when ngOnChanges fires without a "data" change', () => {
    component.ngOnChanges({});

    expect(userServiceMock.getById).not.toHaveBeenCalled();
  });

  it('resolves both create and modify user names when both ids are present', () => {
    userServiceMock.getById.mockImplementation((id: string) =>
      of({
        data: id === 'u1' ? { firstName: 'Ana', lastName: 'Silva' } : { firstName: 'Joao', lastName: 'Souza' },
      }),
    );
    component.data = { createUserId: 'u1', modifyUserId: 'u2' };

    component.ngOnChanges({ data: {} as never });

    expect(userServiceMock.getById).toHaveBeenCalledWith('u1');
    expect(userServiceMock.getById).toHaveBeenCalledWith('u2');
    expect(component.createUserName).toBe('Ana Silva');
    expect(component.modifyUserName).toBe('Joao Souza');
  });

  it('does not call the service for an id that is not present', () => {
    userServiceMock.getById.mockReturnValue(of({ data: { firstName: 'Ana' } as User }));
    component.data = { createUserId: 'u1' };

    component.ngOnChanges({ data: {} as never });

    expect(userServiceMock.getById).toHaveBeenCalledTimes(1);
    expect(userServiceMock.getById).toHaveBeenCalledWith('u1');
  });

  it('resets both names to empty before resolving on every data change', () => {
    component.createUserName = 'stale name';
    component.modifyUserName = 'stale name';
    component.data = null;

    component.ngOnChanges({ data: {} as never });

    expect(component.createUserName).toBe('');
    expect(component.modifyUserName).toBe('');
  });

  it('falls back to userName when first/last name are both absent', () => {
    userServiceMock.getById.mockReturnValue(of({ data: { userName: 'ana.silva' } as User }));
    component.data = { createUserId: 'u1' };

    component.ngOnChanges({ data: {} as never });

    expect(component.createUserName).toBe('ana.silva');
  });

  it('resolves to an empty string when the user is not found', () => {
    userServiceMock.getById.mockReturnValue(of({ data: null }));
    component.data = { createUserId: 'u1' };

    component.ngOnChanges({ data: {} as never });

    expect(component.createUserName).toBe('');
  });
});
