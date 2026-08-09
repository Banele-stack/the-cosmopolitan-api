import { Controller, Get } from '@nestjs/common';
import { BusinessCategoryService } from './business-category.service';

@Controller('business-categories')
export class BusinessCategoryController {
  constructor(
    private readonly businessCategoryService: BusinessCategoryService,
  ) {}

  @Get()
  findAll() {
    return this.businessCategoryService.findAllTree();
  }
}
