import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { BusinessController } from './business.controller';
import { BusinessService } from './business.service';
import { UploadHashService } from 'src/uploads/upload-hash.service';
import { UPLOAD_STORAGE } from 'src/uploads/storage/storage.interface';

describe('BusinessController', () => {
  let controller: BusinessController;

  const mockBusinessService = {
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
      controllers: [BusinessController],
      providers: [
        {
          provide: BusinessService,
          useValue: mockBusinessService,
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
      // create() is guarded by ThrottlerGuard, which needs the real
      // ThrottlerModule wired up to resolve its options/storage — not
      // relevant to what these tests actually exercise, so it's swapped
      // for a stub that always allows the request through.
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<BusinessController>(BusinessController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('forwards page and limit as a separate pagination argument to the service, coercing boolean query params', () => {
      controller.findAll(
        'Sandton',
        'restaurants',
        'lunch-box-packages',
        'pizza',
        'true',
        'true',
        undefined,
        undefined,
        'true',
        '$$',
        undefined,
        undefined,
        '2',
        '5',
      );

      expect(mockBusinessService.findAll).toHaveBeenCalledWith(
        {
          location: 'Sandton',
          categorySlug: 'restaurants',
          subcategorySlug: 'lunch-box-packages',
          search: 'pizza',
          openNow: true,
          deliveryAvailable: true,
          onlineOnly: false,
          nearby: false,
          highlyRated: true,
          priceRange: '$$',
          lat: undefined,
          lng: undefined,
        },
        { page: '2', limit: '5' },
      );
    });

    it('passes page/limit through as undefined when the client omits them', () => {
      controller.findAll();

      expect(mockBusinessService.findAll).toHaveBeenCalledWith(
        {
          location: undefined,
          categorySlug: undefined,
          subcategorySlug: undefined,
          search: undefined,
          openNow: false,
          deliveryAvailable: false,
          onlineOnly: false,
          nearby: false,
          highlyRated: false,
          priceRange: undefined,
          lat: undefined,
          lng: undefined,
        },
        { page: undefined, limit: undefined },
      );
    });
  });
});
