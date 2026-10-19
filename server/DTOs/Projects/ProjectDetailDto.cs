using System;
using System.Collections.Generic;
using ProjectManager.API.Models;

namespace ProjectManager.API.DTOs
{
    public class ProjectDetailDto : ProjectDto
    {
        public List<OwnerDto> Owners { get; set; }
        // Документы добавим в 3-м спринте
        // public List<DocumentDto> Documents { get; set; }
    }
}