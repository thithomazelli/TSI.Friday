using System.Linq.Expressions;
using AutoMapper;
using FluentAssertions;
using Moq;
using TSI.Nexus.Contracts.Enums;
using TSI.Nexus.Contracts.Interfaces;
using TSI.Nexus.Contracts.Models;
using TSI.Nexus.Contracts.Models.DTOs;
using TSI.Nexus.Contracts.Utilities;
using TSI.Nexus.IoC;
using Microsoft.Extensions.Logging;

namespace TSI.Nexus.Services.Tests.Services
{
    public class EventServiceTests
    {
        private readonly EventService _eventService;
        private readonly Mock<IRepository<Event>> _repository;
        private readonly Mock<IRepository<User>> _userRepository;
        private readonly Mock<ICurrentUserService> _currentUserService;
        private readonly Mock<ILogService> _logService;
        private readonly IMapper _mapper;

        public EventServiceTests()
        {
            var config = new MapperConfiguration(
                cfg =>
                {
                    cfg.ConstructServicesUsing(type => null);
                    cfg.AddMaps(typeof(MappingProfile).Assembly);
                },
                new LoggerFactory()
            );
            _mapper = config.CreateMapper();

            _repository = new Mock<IRepository<Event>>();
            _userRepository = new Mock<IRepository<User>>();
            _currentUserService = new Mock<ICurrentUserService>();
            _logService = new Mock<ILogService>();

            _currentUserService.Setup(c => c.GetUserId()).Returns("current-user-id");
            _userRepository
                .Setup(r =>
                    r.QueryAsync(It.IsAny<Expression<Func<User, bool>>>(), true)
                )
                .ReturnsAsync(new List<User>());

            _eventService = new EventService(
                _repository.Object,
                _userRepository.Object,
                _currentUserService.Object,
                _mapper,
                _logService.Object
            );
        }

        [Fact]
        public async Task EventService_Add_ShouldRejectItem_WhenNoLinkIsSet()
        {
            // Arrange
            var eventDto = new EventDto { Title = "Reunião", EventTypeOptionId = Guid.NewGuid() };

            // Act
            var result = await _eventService.Add(eventDto);

            // Assert
            result.Status.Should().Be(ResponseStatus.Error);
            _repository.Verify(r => r.AddAsync(It.IsAny<Event>()), Times.Never);
        }

        [Fact]
        public async Task EventService_Add_ShouldAddItemSuccessfully_WhenLinkedToAnEntity()
        {
            // Arrange
            var eventDto = new EventDto
            {
                Title = "Reunião com cliente",
                EventTypeOptionId = Guid.NewGuid(),
                StartDate = DateTime.UtcNow,
                EndDate = DateTime.UtcNow.AddHours(1),
                BusinessPartnerId = Guid.NewGuid(),
            };
            _repository.Setup(r => r.AddAsync(It.IsAny<Event>())).Returns(Task.CompletedTask);

            // Act
            var result = await _eventService.Add(eventDto);

            // Assert
            result.Status.Should().Be(ResponseStatus.Success);
            result.Data.CreatedByUserId.Should().Be("current-user-id");
            _repository.Verify(r => r.AddAsync(It.IsAny<Event>()), Times.Once);
        }

        [Fact]
        public async Task EventService_Update_ShouldRejectItem_WhenNoLinkIsSet()
        {
            // Arrange
            var eventDto = new EventDto { Id = Guid.NewGuid(), Title = "Reunião" };

            // Act
            var result = await _eventService.Update(eventDto);

            // Assert
            result.Status.Should().Be(ResponseStatus.Error);
            _repository.Verify(r => r.UpdateAsync(It.IsAny<Event>()), Times.Never);
        }

        [Fact]
        public async Task EventService_Update_ShouldUpdateItemSuccessfully_WhenLinkedToAnEntity()
        {
            // Arrange
            var eventDto = new EventDto
            {
                Id = Guid.NewGuid(),
                Title = "Reunião",
                OrderId = Guid.NewGuid(),
            };
            _repository.Setup(r => r.UpdateAsync(It.IsAny<Event>())).Returns(Task.CompletedTask);

            // Act
            var result = await _eventService.Update(eventDto);

            // Assert
            result.Status.Should().Be(ResponseStatus.Success);
            _repository.Verify(r => r.UpdateAsync(It.IsAny<Event>()), Times.Once);
        }

        [Fact]
        public async Task EventService_Remove_ShouldRemoveItemSuccessfully_WhenMethodIsCalledWithAValidObject()
        {
            // Arrange
            var eventDto = new EventDto { Id = Guid.NewGuid(), Title = "Reunião" };
            _repository
                .Setup(r => r.GetByIdAsync(It.IsAny<Guid>()))
                .ReturnsAsync(new Event());
            _repository
                .Setup(r => r.RemoveAsync(It.IsAny<Event>()))
                .Returns(Task.CompletedTask);

            // Act
            var result = await _eventService.Remove(eventDto);

            // Assert
            result.Status.Should().Be(ResponseStatus.Success);
            _repository.Verify(r => r.RemoveAsync(It.IsAny<Event>()), Times.Once);
        }

        [Fact]
        public async Task EventService_FindById_ShouldReturnItem_WhenIdIsValid()
        {
            // Arrange
            var id = Guid.NewGuid();
            var entity = new Event { Id = id, Title = "Reunião", OrderId = Guid.NewGuid() };
            _repository
                .Setup(r =>
                    r.GetByIdAsync(
                        It.IsAny<object>(),
                        true,
                        It.IsAny<Expression<Func<Event, object>>[]>()
                    )
                )
                .ReturnsAsync(entity);

            // Act
            var result = await _eventService.FindById(id);

            // Assert
            result.Status.Should().Be(ResponseStatus.Success);
            result.Data.Title.Should().Be("Reunião");
        }

        [Fact]
        public async Task EventService_FindByOrderId_ShouldReturnItems_WhenOrderIdIsValid()
        {
            // Arrange
            var orderId = Guid.NewGuid();
            var items = new List<Event>
            {
                new() { Id = Guid.NewGuid(), Title = "Entrega", OrderId = orderId },
            };
            _repository
                .Setup(r =>
                    r.QueryAsync(
                        It.IsAny<Expression<Func<Event, bool>>>(),
                        true,
                        It.IsAny<Expression<Func<Event, object>>[]>()
                    )
                )
                .ReturnsAsync(items);

            // Act
            var result = await _eventService.FindByOrderId(orderId);

            // Assert
            result.Status.Should().Be(ResponseStatus.Success);
            result.Data.Should().ContainSingle(e => e.Title == "Entrega");
        }

        [Fact]
        public async Task EventService_FindByUserId_ShouldReturnItems_WhenUserIdIsValid()
        {
            // Arrange
            const string userId = "user-1";
            var items = new List<Event>
            {
                new()
                {
                    Id = Guid.NewGuid(),
                    Title = "Follow-up",
                    CreatedByUserId = userId,
                    VehicleId = Guid.NewGuid(),
                },
            };
            _repository
                .Setup(r =>
                    r.QueryAsync(
                        It.IsAny<Expression<Func<Event, bool>>>(),
                        true,
                        It.IsAny<Expression<Func<Event, object>>[]>()
                    )
                )
                .ReturnsAsync(items);

            // Act
            var result = await _eventService.FindByUserId(userId);

            // Assert
            result.Status.Should().Be(ResponseStatus.Success);
            result.Data.Should().ContainSingle(e => e.Title == "Follow-up");
        }

        [Fact]
        public async Task EventService_Add_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var eventDto = new EventDto { Title = "Reunião", OrderId = Guid.NewGuid() };
            _repository.Setup(r => r.AddAsync(It.IsAny<Event>())).ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _eventService.Add(eventDto);

            // Assert
            result.Status.Should().Be(ResponseStatus.Error);
            _logService.Verify(
                _ => _.LogException(It.IsAny<Exception>(), "EventService.Add", eventDto),
                Times.Once
            );
        }

        [Fact]
        public async Task EventService_Update_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var eventDto = new EventDto { Title = "Reunião", OrderId = Guid.NewGuid() };
            _repository.Setup(r => r.UpdateAsync(It.IsAny<Event>())).ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _eventService.Update(eventDto);

            // Assert
            result.Status.Should().Be(ResponseStatus.Error);
        }

        [Fact]
        public async Task EventService_Remove_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            var eventDto = new EventDto { Id = Guid.NewGuid(), Title = "Reunião" };
            _repository.Setup(r => r.GetByIdAsync(It.IsAny<object>())).ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _eventService.Remove(eventDto);

            // Assert
            result.Status.Should().Be(ResponseStatus.Error);
        }

        [Fact]
        public async Task EventService_FindById_ShouldReturnNoData_WhenNotFound()
        {
            // Arrange
            var id = Guid.NewGuid();
            _repository
                .Setup(r =>
                    r.GetByIdAsync(It.IsAny<object>(), true, It.IsAny<Expression<Func<Event, object>>[]>())
                )
                .ReturnsAsync((Event)null!);

            // Act
            var result = await _eventService.FindById(id);

            // Assert
            result.Status.Should().Be(ResponseStatus.Success);
            result.Data.Should().BeNull();
            result.Message.Should().Be($"Nenhum Evento com o ID {id} foi encontrado");
        }

        [Fact]
        public async Task EventService_FindById_ShouldReturnError_WhenRepositoryThrows()
        {
            // Arrange
            _repository
                .Setup(r =>
                    r.GetByIdAsync(It.IsAny<object>(), true, It.IsAny<Expression<Func<Event, object>>[]>())
                )
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _eventService.FindById(Guid.NewGuid());

            // Assert
            result.Status.Should().Be(ResponseStatus.Error);
        }

        [Fact]
        public async Task EventService_FindById_ShouldResolveParticipantDisplayNames_ForRegisteredUsers()
        {
            // Arrange
            var id = Guid.NewGuid();
            var entity = new Event
            {
                Id = id,
                Title = "Reunião",
                OrderId = Guid.NewGuid(),
                Participants = new List<EventParticipant>
                {
                    new() { Id = Guid.NewGuid(), UserId = "user-1" },
                },
            };
            _repository
                .Setup(r =>
                    r.GetByIdAsync(It.IsAny<object>(), true, It.IsAny<Expression<Func<Event, object>>[]>())
                )
                .ReturnsAsync(entity);
            _userRepository
                .Setup(r => r.QueryAsync(It.IsAny<Expression<Func<User, bool>>>(), true))
                .ReturnsAsync(new List<User> { new() { Id = "user-1", FirstName = "Ana", LastName = "Silva" } });

            // Act
            var result = await _eventService.FindById(id);

            // Assert
            result.Status.Should().Be(ResponseStatus.Success);
            result.Data!.Participants.Should().ContainSingle(p => p.DisplayName == "Ana Silva");
        }

        [Fact]
        public async Task EventService_FindAll_ShouldReturnItems()
        {
            // Arrange
            var items = new List<Event> { new() { Id = Guid.NewGuid(), Title = "Evento", OrderId = Guid.NewGuid() } };
            _repository.Setup(r => r.GetAllAsync(true, It.IsAny<Expression<Func<Event, object>>[]>())).ReturnsAsync(items);

            // Act
            var result = await _eventService.FindAll();

            // Assert
            result.Status.Should().Be(ResponseStatus.Success);
            result.Data.Should().ContainSingle();
        }

        [Fact]
        public async Task EventService_FindAll_ShouldPropagateException_WhenRepositoryThrows()
        {
            // Arrange - unlike Add/Update/Remove/FindById, FindAll's repository call sits outside
            // ToResponseAsync's try/catch (only the mapping step is guarded), so a repository
            // failure here propagates instead of turning into an Error WebApiResponse. Documented
            // as current behavior; see the final report for this finding.
            _repository
                .Setup(r => r.GetAllAsync(true, It.IsAny<Expression<Func<Event, object>>[]>()))
                .ThrowsAsync(new Exception("boom"));

            // Act & Assert
            await Assert.ThrowsAsync<Exception>(() => _eventService.FindAll());
        }

        private void SetupQuery(List<Event> items)
        {
            _repository
                .Setup(r =>
                    r.QueryAsync(
                        It.IsAny<Expression<Func<Event, bool>>>(),
                        true,
                        It.IsAny<Expression<Func<Event, object>>[]>()
                    )
                )
                .ReturnsAsync(items);
        }

        [Fact]
        public async Task EventService_FindByBusinessPartnerId_ShouldReturnItems()
        {
            // Arrange
            var bpId = Guid.NewGuid();
            SetupQuery(new List<Event> { new() { Id = Guid.NewGuid(), Title = "E", BusinessPartnerId = bpId } });

            // Act
            var result = await _eventService.FindByBusinessPartnerId(bpId);

            // Assert
            result.Status.Should().Be(ResponseStatus.Success);
            result.Data.Should().ContainSingle();
        }

        [Fact]
        public async Task EventService_FindByQuoteId_ShouldReturnItems()
        {
            // Arrange
            var quoteId = Guid.NewGuid();
            SetupQuery(new List<Event> { new() { Id = Guid.NewGuid(), Title = "E", QuoteId = quoteId } });

            // Act
            var result = await _eventService.FindByQuoteId(quoteId);

            // Assert
            result.Status.Should().Be(ResponseStatus.Success);
            result.Data.Should().ContainSingle();
        }

        [Fact]
        public async Task EventService_FindByPurchaseOrderId_ShouldReturnItems()
        {
            // Arrange
            var purchaseOrderId = Guid.NewGuid();
            SetupQuery(
                new List<Event> { new() { Id = Guid.NewGuid(), Title = "E", PurchaseOrderId = purchaseOrderId } }
            );

            // Act
            var result = await _eventService.FindByPurchaseOrderId(purchaseOrderId);

            // Assert
            result.Status.Should().Be(ResponseStatus.Success);
            result.Data.Should().ContainSingle();
        }

        [Fact]
        public async Task EventService_FindByTripId_ShouldReturnItems()
        {
            // Arrange
            var tripId = Guid.NewGuid();
            SetupQuery(new List<Event> { new() { Id = Guid.NewGuid(), Title = "E", TripId = tripId } });

            // Act
            var result = await _eventService.FindByTripId(tripId);

            // Assert
            result.Status.Should().Be(ResponseStatus.Success);
            result.Data.Should().ContainSingle();
        }

        [Fact]
        public async Task EventService_FindByTransactionId_ShouldReturnItems()
        {
            // Arrange
            var transactionId = Guid.NewGuid();
            SetupQuery(new List<Event> { new() { Id = Guid.NewGuid(), Title = "E", TransactionId = transactionId } });

            // Act
            var result = await _eventService.FindByTransactionId(transactionId);

            // Assert
            result.Status.Should().Be(ResponseStatus.Success);
            result.Data.Should().ContainSingle();
        }

        [Fact]
        public async Task EventService_FindByPaymentId_ShouldReturnItems()
        {
            // Arrange
            var paymentId = Guid.NewGuid();
            SetupQuery(new List<Event> { new() { Id = Guid.NewGuid(), Title = "E", PaymentId = paymentId } });

            // Act
            var result = await _eventService.FindByPaymentId(paymentId);

            // Assert
            result.Status.Should().Be(ResponseStatus.Success);
            result.Data.Should().ContainSingle();
        }

        [Fact]
        public async Task EventService_FindByVehicleId_ShouldReturnItems()
        {
            // Arrange
            var vehicleId = Guid.NewGuid();
            SetupQuery(new List<Event> { new() { Id = Guid.NewGuid(), Title = "E", VehicleId = vehicleId } });

            // Act
            var result = await _eventService.FindByVehicleId(vehicleId);

            // Assert
            result.Status.Should().Be(ResponseStatus.Success);
            result.Data.Should().ContainSingle();
        }

        [Fact]
        public async Task EventService_FindByDriverId_ShouldReturnItems()
        {
            // Arrange
            var driverId = Guid.NewGuid();
            SetupQuery(new List<Event> { new() { Id = Guid.NewGuid(), Title = "E", DriverId = driverId } });

            // Act
            var result = await _eventService.FindByDriverId(driverId);

            // Assert
            result.Status.Should().Be(ResponseStatus.Success);
            result.Data.Should().ContainSingle();
        }

        [Fact]
        public async Task EventService_FindByVehicleMaintenanceId_ShouldReturnItems()
        {
            // Arrange
            var maintenanceId = Guid.NewGuid();
            SetupQuery(
                new List<Event> { new() { Id = Guid.NewGuid(), Title = "E", VehicleMaintenanceId = maintenanceId } }
            );

            // Act
            var result = await _eventService.FindByVehicleMaintenanceId(maintenanceId);

            // Assert
            result.Status.Should().Be(ResponseStatus.Success);
            result.Data.Should().ContainSingle();
        }

        [Fact]
        public async Task EventService_FindByFuelLogId_ShouldReturnItems()
        {
            // Arrange
            var fuelLogId = Guid.NewGuid();
            SetupQuery(new List<Event> { new() { Id = Guid.NewGuid(), Title = "E", FuelLogId = fuelLogId } });

            // Act
            var result = await _eventService.FindByFuelLogId(fuelLogId);

            // Assert
            result.Status.Should().Be(ResponseStatus.Success);
            result.Data.Should().ContainSingle();
        }

        [Fact]
        public async Task EventService_FindByOrderId_ShouldPropagateException_WhenRepositoryThrows()
        {
            // Arrange - same underlying gap as FindAll: the QueryAsync call is outside
            // ToResponseAsync's try/catch, so a repository failure propagates rather than
            // producing an Error WebApiResponse.
            _repository
                .Setup(r =>
                    r.QueryAsync(
                        It.IsAny<Expression<Func<Event, bool>>>(),
                        true,
                        It.IsAny<Expression<Func<Event, object>>[]>()
                    )
                )
                .ThrowsAsync(new Exception("boom"));

            // Act & Assert
            await Assert.ThrowsAsync<Exception>(() => _eventService.FindByOrderId(Guid.NewGuid()));
        }

        [Fact]
        public async Task EventService_FindAll_ShouldReturnError_WhenResolvingParticipantNamesThrows()
        {
            // Arrange - this exercises ToResponseAsync's own try/catch: the repository call
            // succeeds, but the participant-name lookup that runs inside ToResponseAsync fails.
            var items = new List<Event>
            {
                new()
                {
                    Id = Guid.NewGuid(),
                    Title = "E",
                    OrderId = Guid.NewGuid(),
                    Participants = new List<EventParticipant> { new() { Id = Guid.NewGuid(), UserId = "user-1" } },
                },
            };
            _repository
                .Setup(r => r.GetAllAsync(true, It.IsAny<Expression<Func<Event, object>>[]>()))
                .ReturnsAsync(items);
            _userRepository
                .Setup(r => r.QueryAsync(It.IsAny<Expression<Func<User, bool>>>(), true))
                .ThrowsAsync(new Exception("boom"));

            // Act
            var result = await _eventService.FindAll();

            // Assert
            result.Status.Should().Be(ResponseStatus.Error);
        }
    }
}
