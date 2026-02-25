
-- Step 1: Change columns to text first
ALTER TABLE produtos_catalogo ALTER COLUMN categoria TYPE text;
ALTER TABLE receitas ALTER COLUMN produto_categoria TYPE text;
ALTER TABLE parcelas_mentoria ALTER COLUMN tipo_mentoria TYPE text;

-- Step 2: Drop old enum
DROP TYPE produto_categoria;

-- Step 3: Update existing data
UPDATE produtos_catalogo SET categoria = 'Mentorias' WHERE categoria IN ('Mentoria Outsider', 'Mentoria Digital Beauty', 'Consultoria Premium', 'Consultoria Express');
UPDATE produtos_catalogo SET categoria = 'Renovações' WHERE categoria = 'Renovação Mentoria';
UPDATE produtos_catalogo SET categoria = 'Digitais' WHERE categoria IN ('Curso/Formação', 'Ferramenta', 'Apostila', 'Outros');
UPDATE produtos_catalogo SET categoria = 'Físicos' WHERE categoria = 'Produto Físico';

UPDATE receitas SET produto_categoria = 'Mentorias' WHERE produto_categoria IN ('Mentoria Outsider', 'Mentoria Digital Beauty', 'Consultoria Premium', 'Consultoria Express');
UPDATE receitas SET produto_categoria = 'Renovações' WHERE produto_categoria = 'Renovação Mentoria';
UPDATE receitas SET produto_categoria = 'Digitais' WHERE produto_categoria IN ('Curso/Formação', 'Ferramenta', 'Apostila', 'Outros');
UPDATE receitas SET produto_categoria = 'Físicos' WHERE produto_categoria = 'Produto Físico';

UPDATE parcelas_mentoria SET tipo_mentoria = 'Mentorias' WHERE tipo_mentoria IN ('Mentoria Outsider', 'Mentoria Digital Beauty', 'Consultoria Premium', 'Consultoria Express');
UPDATE parcelas_mentoria SET tipo_mentoria = 'Renovações' WHERE tipo_mentoria = 'Renovação Mentoria';
UPDATE parcelas_mentoria SET tipo_mentoria = 'Digitais' WHERE tipo_mentoria IN ('Curso/Formação', 'Ferramenta', 'Apostila', 'Outros');
UPDATE parcelas_mentoria SET tipo_mentoria = 'Físicos' WHERE tipo_mentoria = 'Produto Físico';

-- Step 4: Create new enum
CREATE TYPE produto_categoria AS ENUM ('Mentorias', 'Renovações', 'Digitais', 'Físicos');

-- Step 5: Cast columns back to enum
ALTER TABLE produtos_catalogo ALTER COLUMN categoria TYPE produto_categoria USING categoria::produto_categoria;
ALTER TABLE receitas ALTER COLUMN produto_categoria TYPE produto_categoria USING produto_categoria::produto_categoria;
ALTER TABLE parcelas_mentoria ALTER COLUMN tipo_mentoria TYPE produto_categoria USING tipo_mentoria::produto_categoria;
