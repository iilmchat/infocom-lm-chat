using Microsoft.Extensions.DependencyInjection;
using ProjectManager.API.Services;
using ProjectManager.API.Services.Interfaces;

namespace ProjectManager.API.Extensions
{
    public static class ServiceExtensions
    {
        public static void AddProjectManagerServices(this IServiceCollection services)
        {
            services.AddScoped<IAuthService, AuthService>();
            services.AddScoped<ISessionService, SessionService>();
            services.AddScoped<IProjectService, ProjectService>();
            services.AddScoped<IOwnerService, OwnerService>();
            services.AddScoped<IDocumentService, DocumentService>();
            services.AddScoped<IAuditService, AuditService>();
            services.AddScoped<IIaAssistantService, IaAssistantService>();

            // Новые сервисы
            services.AddScoped<ILmStudioSettingsService, LmStudioSettingsService>();
            services.AddScoped<IAssistantPromptService, AssistantPromptService>();

            services.AddScoped<IArchitectService, ArchitectService>();

            services.AddScoped<IUserService, UserService>(); // новая строка

            services.AddScoped<IOutputPostProcessor, DefaultOutputPostProcessor>();       

            services.AddScoped<IAnalystService, AnalystService>();           

            services.AddScoped<IDeveloperTaskService, DeveloperTaskService>();      

            services.AddScoped<ITesterService, TesterService>();
        }
    }
}