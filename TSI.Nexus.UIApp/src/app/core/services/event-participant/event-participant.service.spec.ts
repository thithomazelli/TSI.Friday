import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ApiService } from '@nexus/core';
import { EventParticipant } from '../../models';
import { EventParticipantService } from './event-participant.service';

describe('EventParticipantService', () => {
  let apiServiceMock: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  function createService(): EventParticipantService {
    apiServiceMock = { get: vi.fn(), post: vi.fn(), delete: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: apiServiceMock }],
    });
    return TestBed.inject(EventParticipantService);
  }

  it('should create', () => {
    expect(createService()).toBeTruthy();
  });

  it('getByEventId hits the expected endpoint', () => {
    const service = createService();
    apiServiceMock.get.mockReturnValue(new Subject());

    service.getByEventId('e1');

    expect(apiServiceMock.get).toHaveBeenCalledWith('eventparticipants/getByEventId/e1');
  });

  it('add hits the expected endpoint with the participant payload', () => {
    const service = createService();
    apiServiceMock.post.mockReturnValue(new Subject());
    const participant = { id: 'p1' } as EventParticipant;

    service.add(participant);

    expect(apiServiceMock.post).toHaveBeenCalledWith('eventparticipants/add', participant);
  });

  it('delete hits the expected endpoint with the participant payload', () => {
    const service = createService();
    apiServiceMock.delete.mockReturnValue(new Subject());
    const participant = { id: 'p1' } as EventParticipant;

    service.delete(participant);

    expect(apiServiceMock.delete).toHaveBeenCalledWith('eventparticipants/remove', participant);
  });
});
