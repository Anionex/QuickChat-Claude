import sqlite3
from datetime import datetime

def init_db():
    conn = sqlite3.connect('chats.db')
    c = conn.cursor()
    
    # Create chats table
    c.execute('''
        CREATE TABLE IF NOT EXISTS chats (
            id INTEGER PRIMARY KEY,
            name TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Check if messages table exists
    cursor = c.execute('''
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='messages'
    ''')
    
    if cursor.fetchone() is None:
        # Create new messages table with tree structure
        c.execute('''
            CREATE TABLE messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chat_id INTEGER,
                parent_id INTEGER,
                branch_number INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT 1,
                role TEXT,
                content TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (chat_id) REFERENCES chats (id),
                FOREIGN KEY (parent_id) REFERENCES messages (id)
            )
        ''')
    else:
        # Check if new columns exist and add them if they don't
        cursor = c.execute('PRAGMA table_info(messages)')
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'parent_id' not in columns:
            c.execute('ALTER TABLE messages ADD COLUMN parent_id INTEGER REFERENCES messages(id)')
        if 'branch_number' not in columns:
            c.execute('ALTER TABLE messages ADD COLUMN branch_number INTEGER DEFAULT 0')
        if 'is_active' not in columns:
            c.execute('ALTER TABLE messages ADD COLUMN is_active BOOLEAN DEFAULT 1')
    
    conn.commit()
    conn.close()

def get_db():
    conn = sqlite3.connect('chats.db')
    conn.row_factory = sqlite3.Row
    return conn

def get_all_chats():
    db = get_db()
    chats = db.execute(
        'SELECT * FROM chats ORDER BY created_at DESC'
    ).fetchall()
    db.close()
    return chats

def get_messages_for_chat(chat_id):
    db = get_db()
    try:
        # Get all messages with tree structure using recursive CTE
        messages = db.execute(
            '''WITH RECURSIVE msg_tree AS (
                -- Get root messages (no parent)
                SELECT id, parent_id, role, content, branch_number, is_active, created_at, 
                       0 as depth, CAST(branch_number as TEXT) as path
                FROM messages 
                WHERE chat_id = ? AND parent_id IS NULL
                
                UNION ALL
                
                -- Get child messages recursively
                SELECT m.id, m.parent_id, m.role, m.content, m.branch_number, m.is_active, 
                       m.created_at, t.depth + 1,
                       t.path || '.' || CAST(m.branch_number as TEXT) as path
                FROM messages m
                JOIN msg_tree t ON m.parent_id = t.id
                WHERE m.chat_id = ?
            )
            SELECT * FROM msg_tree 
            ORDER BY depth, path, created_at''',
            (chat_id, chat_id)
        ).fetchall()
        
        # Check for siblings
        message_list = []
        for msg in messages:
            has_siblings = False
            if msg['parent_id'] is not None:
                siblings = db.execute(
                    'SELECT COUNT(*) as count FROM messages WHERE parent_id = ?',
                    (msg['parent_id'],)
                ).fetchone()
                has_siblings = siblings['count'] > 1
            
            message_list.append({
                'id': msg['id'],
                'parent_id': msg['parent_id'],
                'role': msg['role'],
                'content': msg['content'],
                'branch_number': msg['branch_number'],
                'is_active': msg['is_active'],
                'has_siblings': has_siblings,
                'depth': msg['depth'],
                'path': msg['path']
            })
        
        return message_list
        
    finally:
        db.close()

def create_chat(chat_id):
    db = get_db()
    db.execute('INSERT OR IGNORE INTO chats (id) VALUES (?)', (chat_id,))
    db.commit()
    db.close()

def save_message(chat_id, role, content, parent_id=None):
    db = get_db()
    db.execute(
        '''INSERT INTO messages 
           (chat_id, role, content, parent_id, branch_number, is_active)
           VALUES (?, ?, ?, ?, 0, 1)''',
        (chat_id, role, content, parent_id)
    )
    db.commit()
    last_id = db.execute('SELECT last_insert_rowid()').fetchone()[0]
    db.close()
    return last_id

def update_chat_name(chat_id, name):
    db = get_db()
    db.execute(
        'UPDATE chats SET name = ? WHERE id = ?',
        (name, chat_id)
    )
    db.commit()
    db.close()

def get_chat(chat_id):
    db = get_db()
    chat = db.execute(
        'SELECT * FROM chats WHERE id = ?',
        (chat_id,)
    ).fetchone()
    db.close()
    return chat

def clear_all_chats():
    db = get_db()
    # 先删除所有消息
    db.execute('DELETE FROM messages')
    # 再删除所有对话
    db.execute('DELETE FROM chats')
    db.commit()
    db.close()

# Add new functions for tree operations
def create_message_branch(chat_id, parent_id, role, content):
    db = get_db()
    try:
        # Get highest branch number for this parent
        cursor = db.execute(
            'SELECT MAX(branch_number) FROM messages WHERE parent_id = ?',
            (parent_id,)
        )
        result = cursor.fetchone()
        max_branch = result[0] if result[0] is not None else -1
        new_branch = max_branch + 1
        
        # Insert new message
        db.execute(
            '''INSERT INTO messages 
               (chat_id, parent_id, branch_number, role, content, is_active)
               VALUES (?, ?, ?, ?, ?, 1)''',
            (chat_id, parent_id, new_branch, role, content)
        )
        
        db.commit()
        last_id = db.execute('SELECT last_insert_rowid()').fetchone()[0]
        return last_id
        
    finally:
        db.close()

def switch_branch(message_id, direction):
    db = get_db()
    
    # Get current message info
    msg = db.execute(
        'SELECT parent_id, branch_number FROM messages WHERE id = ?',
        (message_id,)
    ).fetchone()
    
    if not msg or not msg['parent_id']:
        db.close()
        return False
        
    # Find next/previous branch
    if direction == 'next':
        new_branch = db.execute(
            '''SELECT id FROM messages 
               WHERE parent_id = ? AND branch_number > ?
               ORDER BY branch_number LIMIT 1''',
            (msg['parent_id'], msg['branch_number'])
        ).fetchone()
    else:
        new_branch = db.execute(
            '''SELECT id FROM messages 
               WHERE parent_id = ? AND branch_number < ?
               ORDER BY branch_number DESC LIMIT 1''',
            (msg['parent_id'], msg['branch_number'])
        ).fetchone()
    
    if new_branch:
        # Deactivate current branch
        db.execute(
            'UPDATE messages SET is_active = 0 WHERE parent_id = ?',
            (msg['parent_id'],)
        )
        # Activate new branch
        db.execute(
            'UPDATE messages SET is_active = 1 WHERE id = ?',
            (new_branch['id'],)
        )
        db.commit()
        db.close()
        return True
        
    db.close()
    return False
  