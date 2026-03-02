-- Fix the incorrectly saved receita: entrada was 0, so valor_bruto should be 0
UPDATE receitas 
SET valor_bruto = 0, 
    valor_liquido = 0, 
    taxa_plataforma_valor = 0
WHERE id = '2896b3d7-5e2e-420d-b836-4163dc3f900c';