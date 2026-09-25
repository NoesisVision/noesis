using MyCompany.ECommerce.Search;
using MyCompany.ECommerce.Search.Products;
using NoesisVision.Annotations.Technology;
using NoesisVision.Annotations.Technology.CleanArchitecture;

[assembly: DeployableUnit("ecommerce-search")]
[assembly: Tier("Application")]
[assembly: FrameworkLayer]

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddScoped<ProductRepository, ProductElasticRepository>();
builder.Services.AddScoped<SearchDb>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
app.MapSearchProductsApi();
app.Run();