// Методы IsHealthyAsync, GetAvailableModelsAsync, SendChatCompletionAsync 
// получают CancellationToken и передают его в HttpClient вызовы.
public async Task<bool> IsHealthyAsync(CancellationToken cancellationToken = default)
{
    try
    {
        var settings = await _settingsService.GetSettingsAsync();
        var url = $"{settings.BaseUrl}/v1/models";
        var response = await _httpClient.GetAsync(url, cancellationToken);
        return response.IsSuccessStatusCode;
    }
    catch (Exception ex)
    {
        _logger.LogWarning(ex, "Ошибка при проверке доступности LM Studio");
        return false;
    }
}

public async Task<List<string>> GetAvailableModelsAsync(CancellationToken cancellationToken = default)
{
    // ... аналогично с передачей cancellationToken в GetAsync
}

public async Task<LmStudioResponse> SendChatCompletionAsync(
    string systemPrompt, 
    string userMessage, 
    List<ToolDefinition> tools, 
    string model = null,
    CancellationToken cancellationToken = default)
{
    // ... при вызове PostAsync передаём cancellationToken
    response = await _httpClient.PostAsync(url, content, cancellationToken);
}