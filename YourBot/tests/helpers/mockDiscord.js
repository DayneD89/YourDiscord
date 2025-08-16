// Discord.js mocks for testing
// Provides mock Discord objects (messages, reactions, users, etc.)

class MockUser {
  constructor(options = {}) {
    this.id = options.id || '123456789012345678';
    this.tag = options.tag || 'TestUser#1234';
    this.bot = options.bot || false;
  }
}

class MockMember {
  constructor(options = {}) {
    this.user = options.user || new MockUser();
    this.roles = {
      cache: new Map(options.roles || []),
      add: jest.fn(),
      remove: jest.fn(),
    };
    this.permissions = {
      has: jest.fn(() => options.hasPermissions || false),
    };
  }
  
  isCommunicationDisabled() {
    return false;
  }
}

class MockGuild {
  constructor(options = {}) {
    this.id = options.id || '123456789012345678';
    this.members = {
      cache: new Map(),
      fetch: jest.fn(() => Promise.resolve(new MockMember())),
    };
    this.roles = {
      cache: new Map(options.roles || []),
    };
    this.channels = {
      cache: new Map(options.channels || []),
    };
    
    // Add find method to roles cache
    this.roles.cache.find = function(predicate) {
      for (const [key, value] of this) {
        if (predicate(value)) {
          return value;
        }
      }
      return undefined;
    };
  }
}

class MockChannel {
  constructor(options = {}) {
    this.id = options.id || '123456789012345678';
    this.name = options.name || 'test-channel';
    this.type = options.type || 0;
    this.messages = {
      cache: new Map(),
      fetch: jest.fn(),
    };
    this.send = jest.fn(() => Promise.resolve(new MockMessage()));
  }
  
  isTextBased() {
    return true;
  }
}

class MockMessage {
  constructor(options = {}) {
    this.id = options.id || '123456789012345678';
    this.content = options.content || 'Test message';
    this.author = options.author || new MockUser();
    this.guild = options.guild || new MockGuild();
    this.channel = options.channel || new MockChannel();
    this.reactions = {
      cache: new Map(options.reactions || []),
    };
    this.partial = options.partial || false;
    
    this.react = jest.fn();
    this.reply = jest.fn();
    this.edit = jest.fn();
    this.fetch = jest.fn(() => Promise.resolve(this));
  }
}

class MockReaction {
  constructor(options = {}) {
    this.emoji = { name: options.emoji || '✅' };
    this.count = options.count || 1;
    this.me = options.me || false;
    this.message = options.message || new MockMessage();
    this.partial = options.partial || false;
    
    this.fetch = jest.fn(() => Promise.resolve(this));
  }
}

module.exports = {
  MockUser,
  MockMember,
  MockGuild,
  MockChannel,
  MockMessage,
  MockReaction,
};