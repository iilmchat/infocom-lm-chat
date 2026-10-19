using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.EntityFrameworkCore;
using ProjectManager.API.Data;
using ProjectManager.API.Services.Interfaces;
using ProjectManager.API.Services;
using ProjectManager.API.Middleware;
using ProjectManager.API.Extensions;
using ProjectManager.API.Models; // добавляем

namespace ProjectManager.API
{
    public class Startup
    {
        public IConfiguration Configuration { get; }

        public Startup(IConfiguration configuration)
        {
            Configuration = configuration;
        }

        public void ConfigureServices(IServiceCollection services)
        {
            // Добавляем контекст базы данных
            services.AddDbContext<AppDbContext>(options =>
                options.UseSqlServer(Configuration.GetConnectionString("DefaultConnection")));

            // Регистрация сервисов (через расширение)
            services.AddProjectManagerServices();

            // Настройка аутентификации
            services.AddAuthentication("CustomScheme")
                .AddScheme<AuthenticationSchemeOptions, CustomAuthenticationHandler>("CustomScheme", null);
            services.AddAuthorization();

            // Добавляем контроллеры
            services.AddControllers();

            // Настройка CORS (для разработки)
            services.AddCors(options =>
            {
                options.AddPolicy("AllowAll", builder =>
                {
                    builder.AllowAnyOrigin()
                           .AllowAnyMethod()
                           .AllowAnyHeader();
                });
            });

            // Доступ к HttpContext
            services.AddHttpContextAccessor();

            // Регистрация настроек ProjectStorage
            services.Configure<ProjectStorageSettings>(Configuration.GetSection("ProjectStorage"));

            // Регистрация настроек LmStudio
            services.Configure<LmStudioConfig>(Configuration.GetSection("LmStudio"));     

            services.Configure<RateLimitingOptions>(Configuration.GetSection("RateLimiting"));                

            services.AddHttpClient("LmStudioClient", client =>
            {
                // Базовый адрес будет подставляться из настроек в каждом запросе
                client.Timeout = TimeSpan.FromMinutes(5); // Долгие запросы к LLM
            });   

            services.AddHostedService<LmStudioHealthCheckService>();

            // Для rate limiting
            services.AddMemoryCache();            
        }

        public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
        {
            if (env.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();
            }

            // Глобальный middleware обработки ошибок
            app.UseMiddleware<ErrorHandlingMiddleware>();

            // Кастомный middleware аутентификации (ДО UseAuthorization)
            // app.UseMiddleware<AuthMiddleware>(); // удалено – аутентификация теперь стандартная

            app.UseHttpsRedirection();

            // Добавляем поддержку статических файлов (чтобы отдавать test-client.html)
            app.UseStaticFiles();

            app.UseRouting();

            app.UseCors("AllowAll");

            // Т.к. мы не используем стандартную авторизацию, но можем добавить UseAuthorization для совместимости
            //app.UseAuthorization(); // удалено – аутентификация теперь стандартная

            // Важно: порядок UseAuthentication и UseAuthorization
            app.UseAuthentication();
            app.UseAuthorization();            

            // Rate limiting middleware (после аутентификации, но до endpoints)
            app.UseMiddleware<RateLimitingMiddleware>();

            app.UseMiddleware<VersionHeaderMiddleware>();

            app.UseMiddleware<RequestSizeLimitMiddleware>(5 * 1024 * 1024); // 5 МБ

            app.UseEndpoints(endpoints =>
            {
                endpoints.MapControllers();
            });
        }
    }
}