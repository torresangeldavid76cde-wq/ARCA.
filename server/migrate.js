export async function migrate(c){
 const additions=[['users','birthday','DATE NULL'],['users','eps','VARCHAR(100) NULL'],['users','photo_data','MEDIUMTEXT NULL'],['members','user_id','INT UNSIGNED NULL'],['members','born_again','BOOLEAN NOT NULL DEFAULT FALSE'],['members','photo_data','MEDIUMTEXT NULL'],['members','created_at','TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],['courses','book',"VARCHAR(200) NOT NULL DEFAULT ''"],['courses','group_id','INT UNSIGNED NULL'],['events','course_id','INT UNSIGNED NULL'],['events','checkin_token_hash','CHAR(64) NULL']];
 for(const[table,column,type]of additions){const [found]=await c.execute('SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?',[table,column]);if(!found.length)await c.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`)}
 const [memberUserIndex]=await c.execute("SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='members' AND INDEX_NAME='user_id'");
 if(!memberUserIndex.length)await c.query('ALTER TABLE members ADD UNIQUE KEY user_id(user_id)');
 const [memberUserForeignKey]=await c.execute("SELECT 1 FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='members' AND CONSTRAINT_NAME='members_ibfk_user'");
 if(!memberUserForeignKey.length)await c.query('ALTER TABLE members ADD CONSTRAINT members_ibfk_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL');
 await c.query('CREATE TABLE IF NOT EXISTS course_members(course_id INT UNSIGNED NOT NULL,member_id INT UNSIGNED NOT NULL,PRIMARY KEY(course_id,member_id),FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE,FOREIGN KEY(member_id) REFERENCES members(id) ON DELETE CASCADE)');
 await c.query("UPDATE courses SET group_id=(SELECT MIN(id) FROM groups_family) WHERE area='discipulado' AND group_id IS NULL");
}
