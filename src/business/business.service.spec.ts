import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BusinessService } from './business.service';
import { Business } from './entities/business.entity';
import { User } from 'src/users/entities/user.entity';
import { BusinessCategoryService } from 'src/business-category/business-category.service';

describe('BusinessService', () => {
  let service: BusinessService;

  const mockQueryBuilder = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
    getMany: jest.fn(),
    getCount: jest.fn(),
  };

  const mockBusinessRepository = {
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    preload: jest.fn(),
    remove: jest.fn(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
  };

  const mockBusinessCategoryService = {
    findCategoryBySlug: jest.fn(),
    findSubcategoryBySlug: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessService,
        {
          provide: getRepositoryToken(Business),
          useValue: mockBusinessRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: BusinessCategoryService,
          useValue: mockBusinessCategoryService,
        },
      ],
    }).compile();

    service = module.get<BusinessService>(BusinessService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll pagination', () => {
    const businesses = [{ id: 1 }, { id: 2 }] as Business[];

    it('defaults to page 1 / limit 10 when no pagination is given', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([businesses, 25]);

      const result = await service.findAll();

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
      expect(result).toEqual({
        data: businesses.map((business) => ({ ...business, ownerVerified: false })),
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
      mockQueryBuilder.getManyAndCount.mockResolvedValue([businesses, 25]);

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
      mockQueryBuilder.getManyAndCount.mockResolvedValue([businesses, 20]);

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

    it('keeps location/category/subcategory/search filters intact alongside pagination', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([businesses, 2]);

      await service.findAll(
        {
          location: 'Sandton',
          categorySlug: 'food',
          subcategorySlug: 'restaurants',
          search: 'pizza',
          highlyRated: true,
        },
        { page: 1, limit: 10 },
      );

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "business.location->>'area' = :location",
        { location: 'Sandton' },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'category.slug = :categorySlug',
        { categorySlug: 'food' },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'subcategory.slug = :subcategorySlug',
        { subcategorySlug: 'restaurants' },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'LOWER(business.name) LIKE LOWER(:search)',
        { search: '%pizza%' },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'business.rating >= 4',
      );
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
    });

    it('applies deliveryAvailable/onlineOnly/nearby/priceRange as independent filters', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([businesses, 2]);

      await service.findAll(
        {
          deliveryAvailable: true,
          onlineOnly: true,
          nearby: true,
          priceRange: '$$',
        },
        { page: 1, limit: 10 },
      );

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'business.supportsDelivery = true',
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "business.businessType = 'online'",
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "business.businessType = 'physical'",
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'business.priceRange = :priceRange',
        { priceRange: '$$' },
      );
    });

    it('sorts by DB-computed distance, excludes online businesses, and still paginates for a "near me" search', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([businesses, 2]);

      await service.findAll(
        { lat: -26.2, lng: 28.05 },
        { page: 1, limit: 10 },
      );

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "business.businessType != 'online'",
      );
      expect(mockQueryBuilder.addSelect).toHaveBeenCalledWith(
        expect.stringContaining(
          "power((business.location->>'lat')::float",
        ),
        'distance',
      );
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'distance',
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
