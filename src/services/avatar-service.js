// src/services/avatar-service.js
/* Добавлено в 6.1: сервис для управления аватарами пользователей */

/**
 * AvatarService – управление аватарами
 * Поддерживает три режима:
 * - 'emoji' – эмодзи (вручную выбирается)
 * - 'initials' – инициалы на цветном фоне (генерируется автоматически)
 * - 'image' – загруженное пользователем изображение (сохраняется в localStorage как DataURL)
 */
export class AvatarService {
  constructor() {
    // По умолчанию используем эмодзи
    this.defaultType = 'emoji';
    this.defaultEmoji = '👤';
    this.defaultColor = '#7ec8e3';
  }

  /**
   * Генерирует аватар на основе данных пользователя и выбранного типа.
   * @param {Object} user - объект пользователя { name, avatarType?, avatarData?, color? }
   * @param {string} user.name - имя пользователя
   * @param {string} [user.avatarType] - 'emoji' | 'initials' | 'image'
   * @param {string} [user.avatarData] - данные аватара (эмодзи, инициалы или DataURL)
   * @param {string} [user.color] - цвет фона для инициалов
   * @returns {string} HTML-строка для отображения аватара (или DataURL для img)
   */
  getAvatarHTML(user) {
    const type = user.avatarType || this.defaultType;
    const name = user.name || 'User';
    const color = user.color || this.defaultColor;
    let data = user.avatarData;

    if (type === 'emoji') {
      // Если avatarData не задан, берём эмодзи из user.avatar (для обратной совместимости)
      const emoji = data || user.avatar || this.defaultEmoji;
      return `<span class="avatar-emoji" style="font-size: 32px;">${emoji}</span>`;
    }

    if (type === 'initials') {
      // Генерируем инициалы: первые буквы слов (максимум 2)
      const initials = name
        .split(' ')
        .map(word => word.charAt(0).toUpperCase())
        .slice(0, 2)
        .join('');
      return `<span class="avatar-initials" style="display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:50%;background:${color};color:#fff;font-size:20px;font-weight:bold;">${initials}</span>`;
    }

    if (type === 'image') {
      // data должен быть DataURL изображения
      if (data && data.startsWith('data:image')) {
        return `<img class="avatar-image" src="${data}" alt="Аватар" style="width:48px;height:48px;border-radius:50%;object-fit:cover;">`;
      } else {
        // Если изображение не загружено, падаем на инициалы
        return this.getAvatarHTML({ ...user, avatarType: 'initials' });
      }
    }

    // fallback
    return this.getAvatarHTML({ ...user, avatarType: 'emoji' });
  }

  /**
   * Генерирует DataURL для аватара-инициалов на canvas.
   * @param {string} name - имя пользователя
   * @param {string} color - цвет фона (HEX)
   * @param {number} size - размер в пикселях (по умолчанию 100)
   * @returns {string} DataURL изображения (PNG)
   */
  generateInitialsImage(name, color, size = 100) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Фон
    ctx.fillStyle = color || this.defaultColor;
    ctx.fillRect(0, 0, size, size);

    // Текст (инициалы)
    const initials = name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${size * 0.4}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials, size / 2, size / 2);

    return canvas.toDataURL('image/png');
  }

  /**
   * Сжимает загруженное изображение до maxSize×maxSize и возвращает DataURL.
   * @param {File} file - загруженный файл
   * @param {number} maxSize - максимальный размер стороны (по умолчанию 100)
   * @returns {Promise<string>} DataURL сжатого изображения
   */
  compressImage(file, maxSize = 100) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ratio = Math.min(maxSize / img.width, maxSize / img.height);
          canvas.width = Math.round(img.width * ratio);
          canvas.height = Math.round(img.height * ratio);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Сохраняет выбранный тип аватара и данные в объекте пользователя.
   * @param {Object} user - объект пользователя (будет изменён)
   * @param {string} type - 'emoji' | 'initials' | 'image'
   * @param {string} data - соответствующие данные (эмодзи, инициалы или DataURL)
   * @param {string} [color] - цвет фона (для инициалов)
   */
  applyAvatar(user, type, data, color) {
    user.avatarType = type;
    user.avatarData = data;
    if (color) user.color = color;
    // Для обратной совместимости сохраняем также поля avatar и color
    if (type === 'emoji') {
      user.avatar = data;
    } else {
      // Для других типов в avatar сохраняем эмодзи-заглушку, но это не критично
      user.avatar = this.defaultEmoji;
    }
    if (color) user.color = color;
  }
}