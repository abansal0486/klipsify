import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BrandsController } from './brands.controller';
import { BrandsService } from './brands.service';
import { BrandEntity, BrandEntitySchema } from './schemas/brand.schema';
import { BrandProductEntity, BrandProductEntitySchema } from './schemas/brand-product.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BrandEntity.name, schema: BrandEntitySchema },
      { name: BrandProductEntity.name, schema: BrandProductEntitySchema },
    ]),
  ],
  controllers: [BrandsController],
  providers: [BrandsService],
  exports: [BrandsService],
})
export class BrandsModule {}
