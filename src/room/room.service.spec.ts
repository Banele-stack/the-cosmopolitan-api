import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RoomService } from './room.service';
import { Room } from './entities/room.entity';
import { User } from 'src/users/entities/user.entity';

describe('RoomService', () => {
  let service: RoomService;

  const mockQueryBuilder = {
    orderBy: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
    getMany: jest.fn(),
    getCount: jest.fn(),
    getOne: jest.fn(),
    getExists: jest.fn(),
  };

  const mockRoomRepository = {
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomService,
        {
          provide: getRepositoryToken(Room),
          useValue: mockRoomRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<RoomService>(RoomService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll pagination', () => {
    const rooms = [{ id: 1 }, { id: 2 }] as Room[];

    it('defaults to page 1 / limit 10 when no pagination is given', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([rooms, 25]);

      const result = await service.findAll();

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
      expect(result).toEqual({
        data: rooms.map((room) => ({ ...room, ownerVerified: false })),
        pagination: {
          page: 1,
          limit: 10,
          total: 25,
          totalPages: 3,
          hasNext: true,
          hasPrevious: false,
        },
      });
    });

    it('computes skip from page/limit and reports hasNext/hasPrevious for a middle page', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([rooms, 25]);

      const result = await service.findAll(undefined, {
        page: 2,
        limit: 5,
      });

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(5);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(5);
      expect(result.pagination).toEqual({
        page: 2,
        limit: 5,
        total: 25,
        totalPages: 5,
        hasNext: true,
        hasPrevious: true,
      });
    });

    it('reports hasNext=false and hasPrevious=true on the last page', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([rooms, 20]);

      const result = await service.findAll(undefined, {
        page: 2,
        limit: 10,
      });

      expect(result.pagination.hasNext).toBe(false);
      expect(result.pagination.hasPrevious).toBe(true);
    });

    it('falls back to default page/limit for invalid pagination input', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll(undefined, {
        page: '-5',
        limit: 'not-a-number',
      });

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
    });

    it('keeps location/price/tag filters intact alongside pagination', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([rooms, 2]);

      await service.findAll(
        {
          location: 'Sandton',
          filter: '0-2000',
          activeTags: ['WiFi Included'],
        },
        { page: 1, limit: 10 },
      );

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "room.location->>'area' = :location",
        { location: 'Sandton' },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'room.price BETWEEN :min AND :max',
        { min: 0, max: 2000 },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'room.wifi = true',
      );
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
    });

    it('sorts by DB-computed distance and still paginates for a "near me" search', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([rooms, 2]);

      await service.findAll(
        { lat: -26.2, lng: 28.05 },
        { page: 1, limit: 10 },
      );

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        expect.stringContaining("power((room.location->>'lat')::float"),
        'ASC',
      );
      expect(mockQueryBuilder.setParameters).toHaveBeenCalledWith({
        lat: -26.2,
        lng: 28.05,
      });
      // Pagination must still apply on top of the distance sort, not load
      // everything into memory before slicing.
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
    });
  });
});
