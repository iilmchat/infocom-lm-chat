using Microsoft.AspNetCore.Mvc;
using ProjectManager.API.Helpers;

namespace ProjectManager.API.Controllers
{
    /// <summary>
    /// Контроллер для получения информации о версии API.
    /// </summary>
    [ApiController]
    [Route("api")]
    public class VersionController : ControllerBase
    {
        /// <summary>
        /// Возвращает текущую версию API и краткое описание изменений.
        /// </summary>
        /// <returns>Объект с версией и release notes.</returns>
        [HttpGet("version")]
        public IActionResult GetVersion()
        {
            return Ok(new
            {
                version = AppVersion.Current,
                releaseNotes = AppVersion.ReleaseNotes
            });
        }
    }
}