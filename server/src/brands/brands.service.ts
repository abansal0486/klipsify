import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Storage } from '@google-cloud/storage';
import { BrandEntity } from './schemas/brand.schema';
import { BrandProductEntity } from './schemas/brand-product.schema';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { CreateBrandProductDto } from './dto/create-brand-product.dto';
import { UpdateBrandProductDto } from './dto/update-brand-product.dto';

@Injectable()
export class BrandsService {
  private readonly storage: Storage;
  private readonly logger = new Logger(BrandsService.name);

  constructor(
    @InjectModel(BrandEntity.name) private brandModel: Model<BrandEntity>,
    @InjectModel(BrandProductEntity.name) private brandProductModel: Model<BrandProductEntity>,
  ) {
    this.storage = new Storage({
      projectId: process.env.GCP_PROJECT_ID,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private generateViewUrl(gcsPath: string): string {
    return `brands/files/view?filename=${encodeURIComponent(gcsPath)}`;
  }

  private generateDownloadUrl(gcsPath: string): string {
    return `brands/files/download?filename=${encodeURIComponent(gcsPath)}`;
  }

  private async uploadToGCS(file: Express.Multer.File, folder = 'brand-uploads'): Promise<string> {
    const bucketName = process.env.GCP_BUCKET_NAME!;
    const bucket = this.storage.bucket(bucketName);
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${folder}/${Date.now()}-${cleanName}`;
    const blob = bucket.file(filename);
    const stream = blob.createWriteStream({ resumable: false, contentType: file.mimetype });

    return new Promise((resolve, reject) => {
      stream.on('error', (err) => reject(new BadRequestException(`GCS upload failed: ${err.message}`)));
      stream.on('finish', () => {
        this.logger.log(`Uploaded to GCS: ${filename}`);
        resolve(filename);
      });
      stream.end(file.buffer);
    });
  }

  private async deleteFromGCS(gcsPath: string): Promise<void> {
    try {
      const bucketName = process.env.GCP_BUCKET_NAME!;
      await this.storage.bucket(bucketName).file(gcsPath).delete();
    } catch (err) {
      this.logger.warn(`Could not delete GCS file ${gcsPath}: ${err.message}`);
    }
  }

  private assertOwner(resource: any, userId: string, label: string) {
    if (resource.userId.toString() !== userId) {
      throw new ForbiddenException(`Not allowed to access this ${label}`);
    }
  }

  // ── brand CRUD ─────────────────────────────────────────────────────────────

  async createBrand(userId: string, dto: CreateBrandDto, logoFile?: Express.Multer.File) {
    const brandData: any = {
      userId: new Types.ObjectId(userId),
      brandName: dto.brandName,
      industry: dto.industry,
      description: dto.description,
      slogan: dto.slogan,
    };

    if (logoFile) {
      const gcsPath = await this.uploadToGCS(logoFile, 'brand-logos');
      brandData.logoGcsPath = gcsPath;
      brandData.logoUrl = this.generateDownloadUrl(gcsPath);
      brandData.logoViewUrl = this.generateViewUrl(gcsPath);
    }

    const brand = await this.brandModel.create(brandData);
    return brand.toObject();
  }

  async findAllByUser(userId: string) {
    const brands = await this.brandModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .lean();

    const brandIds = brands.map((b) => b._id);
    const products = await this.brandProductModel.find({ brandId: { $in: brandIds } }).lean();

    return brands.map((brand) => ({
      ...brand,
      products: products.filter((p) => p.brandId.toString() === (brand._id as any).toString()),
    }));
  }

  async findOne(userId: string, brandId: string) {
    const brand = await this.brandModel.findById(brandId).lean();
    if (!brand) throw new NotFoundException('Brand not found');
    this.assertOwner(brand, userId, 'brand');

    const products = await this.brandProductModel.find({ brandId: new Types.ObjectId(brandId) }).lean();
    return { ...brand, products };
  }

  async updateBrand(userId: string, brandId: string, dto: UpdateBrandDto, logoFile?: Express.Multer.File) {
    const brand = await this.brandModel.findById(brandId);
    if (!brand) throw new NotFoundException('Brand not found');
    this.assertOwner(brand, userId, 'brand');

    if (dto.brandName !== undefined)   brand.brandName   = dto.brandName;
    if (dto.industry !== undefined)    brand.industry    = dto.industry;
    if (dto.description !== undefined) brand.description = dto.description;
    if (dto.slogan !== undefined)      brand.slogan      = dto.slogan;

    if (logoFile) {
      if (brand.logoGcsPath) await this.deleteFromGCS(brand.logoGcsPath);
      const gcsPath = await this.uploadToGCS(logoFile, 'brand-logos');
      brand.logoGcsPath  = gcsPath;
      brand.logoUrl      = this.generateDownloadUrl(gcsPath);
      brand.logoViewUrl  = this.generateViewUrl(gcsPath);
    }

    await brand.save();
    return brand.toObject();
  }

  async deleteBrand(userId: string, brandId: string) {
    const brand = await this.brandModel.findById(brandId);
    if (!brand) throw new NotFoundException('Brand not found');
    this.assertOwner(brand, userId, 'brand');

    if (brand.logoGcsPath) await this.deleteFromGCS(brand.logoGcsPath);

    const products = await this.brandProductModel.find({ brandId: new Types.ObjectId(brandId) });
    for (const p of products) {
      if (p.productImageGcsPath) await this.deleteFromGCS(p.productImageGcsPath);
    }
    await this.brandProductModel.deleteMany({ brandId: new Types.ObjectId(brandId) });
    await brand.deleteOne();

    return { message: 'Brand deleted successfully' };
  }

  // ── product CRUD ───────────────────────────────────────────────────────────

  async addProduct(userId: string, brandId: string, dto: CreateBrandProductDto, imageFile?: Express.Multer.File) {
    const brand = await this.brandModel.findById(brandId).lean();
    if (!brand) throw new NotFoundException('Brand not found');
    this.assertOwner(brand, userId, 'brand');

    const productData: any = {
      brandId: new Types.ObjectId(brandId),
      userId: new Types.ObjectId(userId),
      productName: dto.productName,
      description: dto.description,
    };

    if (imageFile) {
      const gcsPath = await this.uploadToGCS(imageFile, 'brand-product-images');
      productData.productImageGcsPath = gcsPath;
      productData.productImage = this.generateViewUrl(gcsPath);
    }

    const product = await this.brandProductModel.create(productData);
    return product.toObject();
  }

  async getProducts(userId: string, brandId: string) {
    const brand = await this.brandModel.findById(brandId).lean();
    if (!brand) throw new NotFoundException('Brand not found');
    this.assertOwner(brand, userId, 'brand');

    return this.brandProductModel.find({ brandId: new Types.ObjectId(brandId) }).lean();
  }

  async updateProduct(
    userId: string,
    brandId: string,
    productId: string,
    dto: UpdateBrandProductDto,
    imageFile?: Express.Multer.File,
  ) {
    const product = await this.brandProductModel.findById(productId);
    if (!product) throw new NotFoundException('Product not found');
    if (product.brandId.toString() !== brandId) throw new ForbiddenException('Product does not belong to this brand');
    if (product.userId.toString() !== userId)   throw new ForbiddenException('Not allowed');

    if (dto.productName !== undefined) product.productName = dto.productName;
    if (dto.description !== undefined) product.description = dto.description;

    if (imageFile) {
      if (product.productImageGcsPath) await this.deleteFromGCS(product.productImageGcsPath);
      const gcsPath = await this.uploadToGCS(imageFile, 'brand-product-images');
      product.productImageGcsPath = gcsPath;
      product.productImage = this.generateViewUrl(gcsPath);
    }

    await product.save();
    return product.toObject();
  }

  async deleteProduct(userId: string, brandId: string, productId: string) {
    const product = await this.brandProductModel.findById(productId);
    if (!product) throw new NotFoundException('Product not found');
    if (product.brandId.toString() !== brandId) throw new ForbiddenException('Product does not belong to this brand');
    if (product.userId.toString() !== userId)   throw new ForbiddenException('Not allowed');

    if (product.productImageGcsPath) await this.deleteFromGCS(product.productImageGcsPath);
    await product.deleteOne();

    return { message: 'Product deleted successfully' };
  }

  // ── GCS file streaming ─────────────────────────────────────────────────────

  async streamFile(filename: string, res: any, inline = true) {
    const bucketName = process.env.GCP_BUCKET_NAME!;
    const file = this.storage.bucket(bucketName).file(filename);

    const [exists] = await file.exists();
    if (!exists) throw new NotFoundException('File not found');

    const [metadata] = await file.getMetadata();
    const contentType = (metadata.contentType as string) || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      inline
        ? `inline; filename="${filename.split('/').pop()}"`
        : `attachment; filename="${filename.split('/').pop()}"`,
    );

    file.createReadStream().pipe(res);
  }
}
