const API_BASE = 'https://api.sorcrpg.com';

class SorcAPIClient {
  constructor() {
    this.authKey = localStorage.getItem('authKey') || null;
  }

  async register(email, password, username, firstName, accountType = 'CIVILIAN') {
    const response = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        username,
        firstName,
        accountType
      })
    });

    const data = await response.json();
    if (data.authKey) {
      this.authKey = data.authKey;
      localStorage.setItem('authKey', data.authKey);
    }
    return data;
  }

  async signin(emailOrUsername, password) {
    const isEmail = emailOrUsername.includes('@');
    const response = await fetch(`${API_BASE}/api/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        isEmail 
          ? { email: emailOrUsername, password }
          : { username: emailOrUsername, password }
      )
    });

    const data = await response.json();
    if (data.authKey) {
      this.authKey = data.authKey;
      localStorage.setItem('authKey', data.authKey);
    }
    return data;
  }

  logout() {
    this.authKey = null;
    localStorage.removeItem('authKey');
  }

  async getProfile(username) {
    const response = await fetch(`${API_BASE}/api/profile/${username}`);
    return response.json();
  }

  async getCurrentUser() {
    if (!this.authKey) return null;

    const response = await fetch(`${API_BASE}/api/me`, {
      headers: { 'X-Auth-Key': this.authKey }
    });

    if (!response.ok) {
      if (response.status === 401) {
        this.logout();
      }
      return null;
    }

    return response.json();
  }

  async updateProfile(updates) {
    if (!this.authKey) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE}/api/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Key': this.authKey
      },
      body: JSON.stringify(updates)
    });

    return response.json();
  }

  async getThreads(categoryId, page = 1) {
    const response = await fetch(
      `${API_BASE}/api/forum/threads/${categoryId}?page=${page}`
    );
    return response.json();
  }

  async getThread(threadId) {
    const response = await fetch(`${API_BASE}/api/forum/thread/${threadId}`);
    return response.json();
  }

  async createThread(categoryId, title, body) {
    if (!this.authKey) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE}/api/forum/thread`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Key': this.authKey
      },
      body: JSON.stringify({ categoryId, title, body })
    });

    return response.json();
  }

  async createPost(threadId, body, quotedText = null, quotedAuthor = null) {
    if (!this.authKey) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE}/api/forum/post`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Key': this.authKey
      },
      body: JSON.stringify({
        threadId,
        body,
        quotedText,
        quotedAuthor
      })
    });

    return response.json();
  }

  async likePost(postId) {
    if (!this.authKey) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE}/api/forum/post/${postId}/like`, {
      method: 'POST',
      headers: { 'X-Auth-Key': this.authKey }
    });

    return response.json();
  }

  async generateChatCompletion(messages, model = 'gpt-4o-mini', maxTokens = 500, temperature = 0.7) {
    if (!this.authKey) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Key': this.authKey
      },
      body: JSON.stringify({
        messages,
        model,
        max_tokens: maxTokens,
        temperature
      })
    });

    return response.json();
  }

  async getCharacters() {
    if (!this.authKey) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE}/api/characters`, {
      headers: { 'X-Auth-Key': this.authKey }
    });

    return response.json();
  }

  async createCharacter(name, charClass, race, avatarImage, bio) {
    if (!this.authKey) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE}/api/characters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Key': this.authKey
      },
      body: JSON.stringify({
        name,
        class: charClass,
        race,
        avatarImage,
        bio
      })
    });

    return response.json();
  }

  async sendFellowshipRequest(recipientUsername) {
    if (!this.authKey) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE}/api/fellowship/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Key': this.authKey
      },
      body: JSON.stringify({ recipientUsername })
    });

    return response.json();
  }

  async health() {
    const response = await fetch(`${API_BASE}/api/health`);
    return response.json();
  }
}

const sorcAPI = new SorcAPIClient();
