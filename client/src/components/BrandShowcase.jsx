import BrandCard from "./BrandCard";

export default function BrandShowcase({brands,openBrand}){

return(

<div>

<h2 className="text-xl md:text-2xl font-semibold mb-8 text-purple-600">
Brand Showcase
</h2>

<div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">

{brands.map((brand,i)=>(
<BrandCard
key={i}
brand={brand}
openBrand={openBrand}
/>
))}

</div>

</div>

);
}