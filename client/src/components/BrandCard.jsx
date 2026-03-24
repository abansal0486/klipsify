export default function BrandCard({brand,openBrand}){

return(

<div
onClick={()=>openBrand(brand)}
className="cursor-pointer bg-white rounded-3xl p-5 md:p-6 shadow hover:shadow-xl transition group"
>

<div className="flex items-center gap-3 mb-4">

<div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl"/>

<div>
<h3 className="font-semibold text-gray-700 text-base md:text-lg">{brand.name}</h3>
<p className="text-[10px] md:text-xs text-gray-500">{brand.industry}</p>
</div>

</div>

<p className="text-sm text-gray-600 mb-4">
{brand.slogan}
</p>

<div className="grid grid-cols-3 gap-2">

{brand.products.slice(0,3).map((p,i)=>(
<div key={i} className="overflow-hidden rounded-lg">
<img
src={p.image}
className="h-20 w-full object-cover group-hover:scale-110 transition"
/>
</div>
))}

</div>

</div>

);
}