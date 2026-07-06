-- 22_fix_songs_profiles_fk.sql
-- 修复 songs 表中 creator_id 缺少指向 profiles.id 的外键约束问题，恢复 PostgREST 默认的联表查询。

DO $$
BEGIN
    -- 1. 检查外键约束是否已经存在，如果不存在则添加
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints tc 
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND tc.table_name = 'songs'
          AND kcu.column_name = 'creator_id'
    ) THEN
        ALTER TABLE public.songs 
        ADD CONSTRAINT fk_songs_creator 
        FOREIGN KEY (creator_id) 
        REFERENCES public.profiles(id) 
        ON DELETE SET NULL;
        
        RAISE NOTICE '成功添加 songs 表的 creator_id 外键约束 (fk_songs_creator)';
    ELSE
        RAISE NOTICE 'songs 表已存在指向 profiles 的外键约束，无需重复添加';
    END IF;
END $$;
