import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessCategory } from './entities/business-category.entity';
import { BusinessSubcategory } from './entities/business-subcategory.entity';
import { BUSINESS_CATEGORY_SEED } from './business-category.seed';

@Injectable()
export class BusinessCategoryService implements OnModuleInit {
  private readonly logger = new Logger(BusinessCategoryService.name);

  constructor(
    @InjectRepository(BusinessCategory)
    private readonly categoryRepository: Repository<BusinessCategory>,

    @InjectRepository(BusinessSubcategory)
    private readonly subcategoryRepository: Repository<BusinessSubcategory>,
  ) {}

  async onModuleInit() {
    await this.seed();
  }

  // Additive-only: creates any category/subcategory from BUSINESS_CATEGORY_SEED
  // that isn't already in the database (matched by slug). Existing rows —
  // including ones manually added and not present in the seed list — are
  // never modified or removed.
  async seed() {
    let createdCategories = 0;
    let createdSubcategories = 0;

    for (const categorySeed of BUSINESS_CATEGORY_SEED) {
      let category = await this.categoryRepository.findOne({
        where: { slug: categorySeed.slug },
      });

      if (!category) {
        category = await this.categoryRepository.save(
          this.categoryRepository.create({
            name: categorySeed.name,
            slug: categorySeed.slug,
            sortOrder: categorySeed.sortOrder,
          }),
        );
        createdCategories++;
      }

      for (const subcategorySeed of categorySeed.subcategories) {
        const existing = await this.subcategoryRepository.findOne({
          where: {
            slug: subcategorySeed.slug,
            category: { id: category.id },
          },
          relations: { category: true },
        });

        if (!existing) {
          await this.subcategoryRepository.save(
            this.subcategoryRepository.create({
              category,
              name: subcategorySeed.name,
              slug: subcategorySeed.slug,
              sortOrder: subcategorySeed.sortOrder,
            }),
          );
          createdSubcategories++;
        }
      }
    }

    if (createdCategories || createdSubcategories) {
      this.logger.log(
        `Business category seed: created ${createdCategories} categories, ${createdSubcategories} subcategories.`,
      );
    }
  }

  async findAllTree() {
    return this.categoryRepository.find({
      relations: { subcategories: true },
      order: {
        sortOrder: 'ASC',
        subcategories: {
          sortOrder: 'ASC',
        },
      },
    });
  }

  async findCategoryBySlug(slug: string): Promise<BusinessCategory> {
    const category = await this.categoryRepository.findOne({
      where: { slug },
    });

    if (!category) {
      throw new NotFoundException(
        `Business category with slug "${slug}" not found`,
      );
    }

    return category;
  }

  async findSubcategoryBySlug(
    categoryId: number,
    slug: string,
  ): Promise<BusinessSubcategory> {
    const subcategory = await this.subcategoryRepository.findOne({
      where: { slug, category: { id: categoryId } },
      relations: { category: true },
    });

    if (!subcategory) {
      throw new NotFoundException(
        `Business subcategory with slug "${slug}" not found in this category`,
      );
    }

    return subcategory;
  }
}
