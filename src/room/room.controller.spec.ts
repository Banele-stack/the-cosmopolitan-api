import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { RoomController } from './room.controller';
import { RoomService } from './room.service';
import { UploadHashService } from 'src/uploads/upload-hash.service';
import { UPLOAD_STORAGE } from 'src/uploads/storage/storage.interface';

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

  const mockUploadStorage = {
    save: jest.fn(),
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
        {
          provide: UPLOAD_STORAGE,
          useValue: mockUploadStorage,
        },
      ],
    })
      // create()/addReview() are guarded by ThrottlerGuard, which needs the
      // real ThrottlerModule wired up to resolve its options/storage — not
      // relevant to what these tests actually exercise, so it's swapped
      // for a stub that always allows the request through.
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

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
