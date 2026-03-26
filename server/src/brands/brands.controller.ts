import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  Query,
  Res,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { Response } from 'express';
import { BrandsService } from './brands.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { CreateBrandProductDto } from './dto/create-brand-product.dto';
import { UpdateBrandProductDto } from './dto/update-brand-product.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Brands')
@Controller('brands')
@UseGuards(JwtAuthGuard)
export class BrandsController {
  private readonly logger = new Logger(BrandsController.name);

  constructor(private readonly brandsService: BrandsService) {}

  private getUserId(req: any): string {
    if (!req.user?.id) throw new UnauthorizedException('User not authenticated');
    return req.user.id;
  }

  // ── file serving (public) ──────────────────────────────────────────────────

  @Public()
  @Get('files/view')
  @ApiOperation({ summary: 'Stream a brand file for viewing' })
  async viewFile(@Query('filename') filename: string, @Res() res: Response) {
    await this.brandsService.streamFile(filename, res, true);
  }

  @Public()
  @Get('files/download')
  @ApiOperation({ summary: 'Download a brand file' })
  async downloadFile(@Query('filename') filename: string, @Res() res: Response) {
    await this.brandsService.streamFile(filename, res, false);
  }

  // ── brand CRUD ─────────────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new brand' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Brand created' })
  @UseInterceptors(FileInterceptor('logo'))
  async createBrand(
    @Request() req,
    @Body() dto: CreateBrandDto,
    @UploadedFile() logo?: Express.Multer.File,
  ) {
    const userId = this.getUserId(req);
    this.logger.log(`User ${userId} creating brand: ${dto.brandName}`);
    return this.brandsService.createBrand(userId, dto, logo);
  }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all brands for the authenticated user' })
  async findAll(@Request() req) {
    const userId = this.getUserId(req);
    return this.brandsService.findAllByUser(userId);
  }

  @Get(':brandId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a single brand with its products' })
  async findOne(@Request() req, @Param('brandId') brandId: string) {
    const userId = this.getUserId(req);
    return this.brandsService.findOne(userId, brandId);
  }

  @Put(':brandId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a brand' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('logo'))
  async updateBrand(
    @Request() req,
    @Param('brandId') brandId: string,
    @Body() dto: UpdateBrandDto,
    @UploadedFile() logo?: Express.Multer.File,
  ) {
    const userId = this.getUserId(req);
    return this.brandsService.updateBrand(userId, brandId, dto, logo);
  }

  @Delete(':brandId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a brand and all its products' })
  async deleteBrand(@Request() req, @Param('brandId') brandId: string) {
    const userId = this.getUserId(req);
    return this.brandsService.deleteBrand(userId, brandId);
  }

  // ── product CRUD ───────────────────────────────────────────────────────────

  @Post(':brandId/products')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a product to a brand' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Product added' })
  @UseInterceptors(FileInterceptor('productImage'))
  async addProduct(
    @Request() req,
    @Param('brandId') brandId: string,
    @Body() dto: CreateBrandProductDto,
    @UploadedFile() productImage?: Express.Multer.File,
  ) {
    const userId = this.getUserId(req);
    return this.brandsService.addProduct(userId, brandId, dto, productImage);
  }

  @Get(':brandId/products')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all products for a brand' })
  async getProducts(@Request() req, @Param('brandId') brandId: string) {
    const userId = this.getUserId(req);
    return this.brandsService.getProducts(userId, brandId);
  }

  @Put(':brandId/products/:productId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a product' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('productImage'))
  async updateProduct(
    @Request() req,
    @Param('brandId') brandId: string,
    @Param('productId') productId: string,
    @Body() dto: UpdateBrandProductDto,
    @UploadedFile() productImage?: Express.Multer.File,
  ) {
    const userId = this.getUserId(req);
    return this.brandsService.updateProduct(userId, brandId, productId, dto, productImage);
  }

  @Delete(':brandId/products/:productId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a product' })
  async deleteProduct(
    @Request() req,
    @Param('brandId') brandId: string,
    @Param('productId') productId: string,
  ) {
    const userId = this.getUserId(req);
    return this.brandsService.deleteProduct(userId, brandId, productId);
  }
}
