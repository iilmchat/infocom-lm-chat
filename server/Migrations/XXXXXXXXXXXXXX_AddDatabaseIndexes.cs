// Migrations/XXXXXXXXXXXXXX_AddDatabaseIndexes.cs
using Microsoft.EntityFrameworkCore.Migrations;

namespace InfocomChat.Server.Migrations
{
    public partial class AddDatabaseIndexes : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Индексы для Messages
            migrationBuilder.CreateIndex(
                name: "IX_Messages_RoomId_Timestamp",
                table: "Messages",
                columns: new[] { "RoomId", "Timestamp" }//,
                //descending: new[] { false, true }
                );

            migrationBuilder.CreateIndex(
                name: "IX_Messages_UserId_Timestamp",
                table: "Messages",
                columns: new[] { "UserId", "Timestamp" }//,
                //descending: new[] { false, true }
                    );

            // Индексы для UserRooms
            migrationBuilder.CreateIndex(
                name: "IX_UserRooms_UserId_RoomId",
                table: "UserRooms",
                columns: new[] { "UserId", "RoomId" },
                unique: true,
                filter: "[IsActive] = 1");

            migrationBuilder.CreateIndex(
                name: "IX_UserRooms_RoomId_IsActive",
                table: "UserRooms",
                columns: new[] { "RoomId", "IsActive" });

            // Индексы для PrivateMessages
            migrationBuilder.CreateIndex(
                name: "IX_PrivateMessages_ChatId_Timestamp",
                table: "PrivateMessages",
                columns: new[] { "ChatId", "Timestamp" }//,
                //descending: new[] { false, true }
                );

            migrationBuilder.CreateIndex(
                name: "IX_PrivateMessages_ReceiverId_IsRead",
                table: "PrivateMessages",
                columns: new[] { "ReceiverId", "IsRead" });

            // Индексы для Rooms
            migrationBuilder.CreateIndex(
                name: "IX_Rooms_RoomType_IsActive",
                table: "Rooms",
                columns: new[] { "RoomType", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_Rooms_LastActivity",
                table: "Rooms",
                column: "LastActivity"//,
                //descending: new bool[] { true }
                );

            // Индексы для Users
            migrationBuilder.CreateIndex(
                name: "IX_Users_Role_IsOnline",
                table: "Users",
                columns: new[] { "Role", "IsOnline" });

            migrationBuilder.CreateIndex(
                name: "IX_Users_LastSeen",
                table: "Users",
                column: "LastSeen"//,
                //descending: new bool[] { true }
                );

            // Индекс для поиска по имени пользователя (полнотекстовый для SQL Server)
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT * FROM sys.fulltext_catalogs WHERE name = 'ChatCatalog')
                BEGIN
                    CREATE FULLTEXT CATALOG ChatCatalog AS DEFAULT;
                END
            ");

            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT * FROM sys.fulltext_indexes WHERE object_id = OBJECT_ID('Messages'))
                BEGIN
                    CREATE FULLTEXT INDEX ON Messages(Content)
                    KEY INDEX PK_Messages
                    WITH STOPLIST = SYSTEM;
                END
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(name: "IX_Messages_RoomId_Timestamp", table: "Messages");
            migrationBuilder.DropIndex(name: "IX_Messages_UserId_Timestamp", table: "Messages");
            migrationBuilder.DropIndex(name: "IX_UserRooms_UserId_RoomId", table: "UserRooms");
            migrationBuilder.DropIndex(name: "IX_UserRooms_RoomId_IsActive", table: "UserRooms");
            migrationBuilder.DropIndex(name: "IX_PrivateMessages_ChatId_Timestamp", table: "PrivateMessages");
            migrationBuilder.DropIndex(name: "IX_PrivateMessages_ReceiverId_IsRead", table: "PrivateMessages");
            migrationBuilder.DropIndex(name: "IX_Rooms_RoomType_IsActive", table: "Rooms");
            migrationBuilder.DropIndex(name: "IX_Rooms_LastActivity", table: "Rooms");
            migrationBuilder.DropIndex(name: "IX_Users_Role_IsOnline", table: "Users");
            migrationBuilder.DropIndex(name: "IX_Users_LastSeen", table: "Users");

            migrationBuilder.Sql("DROP FULLTEXT INDEX ON Messages");
            migrationBuilder.Sql("DROP FULLTEXT CATALOG ChatCatalog");
        }
    }
}