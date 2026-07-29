UPDATE public.mentorada_tarefas SET processo_id = NULL WHERE processo_id IS NOT NULL;
DELETE FROM public.processos_etapa;

INSERT INTO public.processos_etapa (etapa, titulo, descricao, ordem, ativo) VALUES
('Onboarding','Enviar mensagem de boas-vindas (WhatsApp)','🎉 Bem-vinda à mentoria! Estou super feliz que você está aqui e pronta para transformar sua trajetória. 🙌✨

Agora vou te explicar exatamente o que fazer para aproveitar ao máximo:

1. Comece pelo módulo de Onboarding: é o primeiro passo. Nele você entende como funciona a mentoria, a metodologia e o que precisa fazer para começar a aplicar. Link: https://alunos.worklash.com.br/area/produto/item/1690744

2. Assista às aulas prontas: todo o conteúdo já está disponível. Assista na sequência certa para entender e aplicar cada estratégia.

3. Participe das reuniões ao vivo (a cada 15 dias, todas gravadas): Implementation Day, Guest Day, Analytics Day e Mentory Day.

4. Plano de ação personalizado: preencha o formulário de diagnóstico para eu montar seu plano exclusivo. Link: https://form.respondi.app/alMYIm0W

5. Fique ativa no grupo de WhatsApp: é onde trocamos ideias e tiramos dúvidas.

6. Estude com o Notion: use o plano de estudos para se organizar.

⚠️ IMPORTANTE: seu sucesso depende 100% da sua dedicação. Assista, aplique e você vai ver diferença já na primeira semana.

🚀 Seja muito bem-vinda mais uma vez, e vamos com tudo!

Login: seu email | Senha: alunoworklash',1,true),
('Onboarding','Enviar link do formulário de onboarding','Enviar o formulário de diagnóstico para a aluna preencher: https://form.respondi.app/alMYIm0W',2,true),
('Onboarding','Confirmar recebimento e assinatura do contrato','Perguntar se recebeu o contrato e confirmar a assinatura.',3,true),
('Onboarding','Liberar acesso à plataforma de aulas (Cademi)','Eduzz libera automático. PIX e parcelado via PIX é liberação manual pela equipe. Criar novo usuário em https://alunos.worklash.com.br/office/usuario/pool. Senha padrão: alunoworklash',4,true),
('Onboarding','Adicionar no grupo geral de alunas','Grupo Lash Outsider: https://chat.whatsapp.com/DBIPPzdDjidIf5QPPLgDtM',5,true),
('Onboarding','Adicionar no grupo de recados','Grupo Recados Lash Outsider: https://chat.whatsapp.com/Fh8bcoTrZkH0x3l5hPuZ37',6,true),
('Onboarding','Criar o grupo individual da aluna','Abrir o grupo individual dela no WhatsApp para acompanhamento próximo.',7,true),
('Onboarding','Enviar link de cadastro no site de educadoras','Enviar o link para a aluna se cadastrar como educadora no site oficial.',8,true),
('Onboarding','Marcar reunião de onboarding no Zoom','Agendar a reunião de onboarding pela aba Agenda e enviar o link para a aluna.',9,true),
('Onboarding','Gerar e enviar o contrato','Criar o contrato com o nome da cliente, adicionar o e-mail dela como signatário e renomear como CONTRATO OUTSIDER - [Nome]. Enviar e confirmar recebimento.',10,true),
('Onboarding','Criar plano de ação personalizado','Após a aluna responder o formulário de diagnóstico, montar o plano de ação no Notion e anexar o link na ficha dela.',11,true),
('Onboarding','Criar carteirinha de educadora no Canva','Gerar a carteirinha de educadora habilitada internacionalmente no Canva.',12,true),
('Onboarding','Criar imagem de divulgação (story)','Gerar a imagem de divulgação de educadora Lash Outsider para a aluna postar.',13,true),
('Onboarding','Registrar no site de educadoras','Cadastrar a aluna no site oficial de educadoras.',14,true);

INSERT INTO public.processos_etapa (etapa, titulo, descricao, ordem, ativo) VALUES
('Ativa','Check-in D+3','Oii [Nome], tudo certo com seu acesso na mentoria? Conseguiu entrar na plataforma e ver as primeiras aulas? 😊',1,true),
('Ativa','Check-in D+7','Oi [Nome], já conseguiu avançar nos conteúdos iniciais? Se precisar de algo, estou aqui para te ajudar! 💜',2,true),
('Ativa','Planejamento mensal (todo dia 1)','Oii [Nome], como foi seu progresso no mês passado? Alguma dificuldade ou ponto que quer ajustar nesse próximo mês? Vamos garantir que você esteja no caminho certo! 💪',3,true),
('Ativa','Acompanhar evolução semanal','Verificar o progresso da mentorada no plano de ação e oferecer suporte direcionado se necessário.',4,true),
('Ativa','Elogiar mentorada que se destaca','[Nome], vi seu progresso e estou super orgulhosa! 🎉 Quer compartilhar sua experiência com o grupo? Isso pode motivar muitas pessoas!',5,true);

INSERT INTO public.processos_etapa (etapa, titulo, descricao, ordem, ativo) VALUES
('Em risco','Mensagem de reativação (15 dias sem interação)','Oi [Nome], percebi que você não tem interagido tanto na mentoria. Está tudo bem? Se precisar de ajuda ou ajuste no seu plano, estou aqui para te apoiar! 💜',1,true),
('Em risco','Segundo contato (7 dias depois, sem resposta)','Oi [Nome], senti sua falta por aqui! Sei que às vezes a rotina fica puxada, mas me avise se puder te ajudar de alguma forma. Quero garantir que você aproveite ao máximo sua jornada! ✨',2,true),
('Em risco','Agendar call de resgate (inativa há mais de 1 mês)','Agendar uma call rápida para entender o que está acontecendo e reengajar a mentorada.',3,true);

INSERT INTO public.processos_etapa (etapa, titulo, descricao, ordem, ativo) VALUES
('Renovação','Mensagem inicial de renovação (1 mês antes)','Oii [Nome]! 💜 Sua mentoria na Lash Outsider está entrando no último mês, e eu queria saber: como foi sua experiência até agora? Você sente que já alcançou tudo o que queria ou ainda há pontos a desenvolver? 🚀 Muitas mentoradas nessa fase percebem que têm novos desafios e novas metas, e por isso continuam conosco para um próximo nível. Se quiser dar um passo maior, já estamos abrindo a fase 2 da mentoria, com condições especiais para quem renovar antecipadamente. Me avisa se quiser saber mais! 💜',1,true),
('Renovação','Oferta de renovação (1 semana antes)','Oi [Nome], tudo bem? 💜 Dia XX/XX sua mentoria chega ao fim, mas queremos muito que você continue por mais um ciclo! ✨ Benefícios para quem renovar agora: garantir o mesmo valor da entrada (ou X% de desconto), acesso por mais X meses, novos conteúdos e acompanhamento, e condições especiais de pagamento. Para garantir, confirme comigo até [data]. Seguimos juntas! 🚀',2,true),
('Renovação','Oferta com incentivo (se não responder)','Oi [Nome]! 💜 Sei que você ainda pode estar pensando na renovação, então quero te dar um incentivo especial! Quem renovar até [data] ganha [descrever bônus]. Me avise para garantir sua vaga! 🚀',3,true),
('Renovação','Follow-up final (2 dias antes do prazo)','Oi [Nome], só passando para lembrar que o prazo para garantir sua renovação com condições especiais termina em [data]! 🚀 Essa é a última chance para manter esse benefício. Me avise se quiser conversar! 💜',4,true),
('Renovação','Confirmar renovação','Confirmar forma de pagamento, gerar o contrato de renovação, atualizar o status para Renovou, readicionar no grupo e enviar: Oii [Nome]! 🎉 Estou MUITO feliz que você escolheu continuar sua evolução comigo! Agora entramos em uma nova fase. Criei um formulário rápido para personalizar sua jornada: [Link do formulário] 💜',5,true),
('Renovação','Fechamento (se não renovou)','Remover do grupo, anotar o motivo e enviar: Oi [Nome], quero te agradecer por essa jornada incrível na Lash Outsider! Foi um prazer ter você aqui. 💜 Se no futuro quiser retomar, estaremos de braços abertos! ✨',6,true);

INSERT INTO public.processos_etapa (etapa, titulo, descricao, ordem, ativo) VALUES
('Inativa','Registrar motivo da inatividade','Anotar por que a aluna ficou inativa (sem interação, sumiu, dificuldade pessoal, etc).',1,true),
('Inativa','Mensagem de porta aberta','Oi [Nome], quero te agradecer por essa jornada na Lash Outsider! Se quiser retomar quando fizer sentido pra você, estaremos de braços abertos. 💜',2,true);

INSERT INTO public.processos_etapa (etapa, titulo, descricao, ordem, ativo) VALUES
('Cancelada','Registrar motivo do cancelamento','Marcar se foi Cancelou a compra ou Removida por inadimplência e anotar detalhes.',1,true),
('Cancelada','Encaminhar cobrança (se inadimplência)','Se o motivo for inadimplência, acionar o fluxo de cobrança ou jurídico conforme o caso.',2,true),
('Cancelada','Remover dos grupos e da plataforma','Remover a aluna dos grupos de WhatsApp e revogar o acesso à plataforma de aulas.',3,true);

INSERT INTO public.processos_etapa (etapa, titulo, descricao, ordem, ativo) VALUES
('Concluída','Mensagem de encerramento e agradecimento','Oi [Nome], sua mentoria chegou ao fim e eu quero muito te agradecer por essa jornada! Foi incrível te acompanhar. 💜 Continua aplicando tudo que construímos juntas.',1,true),
('Concluída','Convidar para depoimento','Convidar a aluna para gravar um depoimento ou case de resultado.',2,true),
('Concluída','Oferecer próximo passo','Apresentar o próximo produto ou nível de continuidade para a aluna que concluiu.',3,true);