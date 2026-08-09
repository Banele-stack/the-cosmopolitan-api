import { Test, TestingModule } from '@nestjs/testing';
import { RoomController } from './room.controller';
import { RoomService } from './room.service';
import { UploadHashService } from 'src/uploads/upload-hash.service';

describe('RoomController', () => {
  let controller: RoomController;

  const mockRoomService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockUploadHashService = {
    recordAndCheck: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoomController],
      providers: [
        {
          provide: RoomService,
          useValue: mockRoomService,
        },
        {
          provide: UploadHashService,
          useValue: mockUploadHashService,
        },
      ],
    }).compile();

    controller = module.get<RoomController>(RoomController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('forwards page and limit as a separate pagination argument to the service', () => {
      controller.findAll(
        'Sandton',
        '0-2000',
        ['WiFi Included'],
        undefined,
        undefined,
        '2',
        '5',
      );

      expect(mockRoomService.findAll).toHaveBeenCalledWith(
        {
          location: 'Sandton',
          filter: '0-2000',
          activeTags: ['WiFi Included'],
          lat: undefined,
          lng: undefined,
        },
        { page: '2', limit: '5' },
      );
    });

    it('passes page/limit through as undefined when the client omits them', () => {
      controller.findAll();

      expect(mockRoomService.findAll).toHaveBeenCalledWith(
        {
          location: undefined,
          filter: undefined,
          activeTags: [],
          lat: undefined,
          lng: undefined,
        },
        { page: undefined, limit: undefined },
      );
    });
  });
});
