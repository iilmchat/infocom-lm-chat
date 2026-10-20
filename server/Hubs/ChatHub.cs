// Hubs/ChatHub.cs
using Microsoft.AspNetCore.SignalR;
using System.Threading.Tasks;
using InfocomChat.Server.Models;
using InfocomChat.Server.Services;

namespace InfocomChat.Server.Hubs
{
    public class ChatHub : Hub
    {
        private readonly RoomManager _roomManager;

        public ChatHub(RoomManager roomManager)
        {
            _roomManager = roomManager;
            
            // Подписываемся на события RoomManager
            _roomManager.OnNewMessage = OnNewMessage;
            _roomManager.OnUserJoined = OnUserJoined;
            _roomManager.OnUserLeft = OnUserLeft;
            _roomManager.OnMessageEdited = OnMessageEdited;
            _roomManager.OnMessageDeleted = OnMessageDeleted;
        }

        public async Task JoinRoom(string roomId, UserInfo user)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, roomId);
            await _roomManager.AddUserToRoomAsync(roomId, user);
        }

        public async Task LeaveRoom(string roomId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, roomId);
            // Пользователь будет удален при отключении
        }

        public async Task SendMessage(string roomId, ChatMessage message)
        {
            await _roomManager.AddMessageAsync(roomId, message);
        }

        public async Task TypingStatus(string roomId, string userId, bool isTyping)
        {
            await Clients.OthersInGroup(roomId).SendAsync("UserTyping", userId, isTyping);
        }

        public override async Task OnDisconnectedAsync(System.Exception exception)
        {
            // Находим комнату пользователя
            foreach (var room in await _roomManager.GetActiveRoomsAsync())
            {
                var user = room.Users.Find(u => u.Id == Context.ConnectionId);
                if (user != null)
                {
                    await _roomManager.RemoveUserFromRoomAsync(room.RoomId, user.Id);
                    await Clients.Group(room.RoomId).SendAsync("UserLeft", user);
                }
            }
            
            await base.OnDisconnectedAsync(exception);
        }

        // Обработчики событий RoomManager
        private async Task OnNewMessage(string roomId, ChatMessage message)
        {
            await Clients.Group(roomId).SendAsync("NewMessage", message);
        }

        private async Task OnUserJoined(string roomId, UserInfo user)
        {
            await Clients.Group(roomId).SendAsync("UserJoined", user);
        }

        private async Task OnUserLeft(string roomId, string userId)
        {
            await Clients.Group(roomId).SendAsync("UserLeft", userId);
        }

        private async Task OnMessageEdited(string roomId, string messageId, string newContent)
        {
            await Clients.Group(roomId).SendAsync("MessageEdited", messageId, newContent);
        }

        private async Task OnMessageDeleted(string roomId, string messageId)
        {
            await Clients.Group(roomId).SendAsync("MessageDeleted", messageId);
        }
    }
}