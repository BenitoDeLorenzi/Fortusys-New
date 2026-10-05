with commercial_rental_clauses as (
  select jsonb_build_array(
    jsonb_build_object(
      'id', 'locacao-comercial-clausula-001',
      'title', 'CLÁUSULA PRIMEIRA',
      'text', 'O objeto deste contrato de locação é o imóvel situado em {{imovel_endereco}}.',
      'order', 1
    ),
    jsonb_build_object(
      'id', 'locacao-comercial-clausula-002',
      'title', 'CLÁUSULA SEGUNDA',
      'text', 'O prazo da locação é de {{tempo_contrato}}, iniciando-se em {{data_inicio}} com término em {{data_fim}}, cessando de pleno direito neste último dia a locação, obrigando-se o(a) LOCATÁRIO(a) a desocupar o imóvel locado independentemente de aviso, notificação ou interpelação judicial ou mesmo extrajudicial, entregando-o nas condições previstas em contrato.',
      'order', 2
    ),
    jsonb_build_object(
      'id', 'locacao-comercial-clausula-003',
      'title', 'CLÁUSULA TERCEIRA',
      'text', 'O aluguel mensal deverá ser pago até o dia {{dia_vencimento}} do mês subsequente ao vencido, no local indicado pelo LOCADOR, e será de {{valor_contrato}} ({{valor_contrato_extenso}}) mensais. A falta de pagamento de qualquer uma das prestações mensais, no prazo estipulado de 30 dias, comportará imediato protesto do título e ingresso da ação de despejo por falta de pagamento, ficando o(a) LOCATÁRIO(a) obrigado(a), ainda, a pagar juros de mora de um por cento ao mês, mais correção monetária, além da multa contratual prevista, e os honorários advocatícios de 20% (vinte por cento) sobre o valor da ação.',
      'order', 3
    ),
    jsonb_build_object(
      'id', 'locacao-comercial-clausula-004',
      'title', 'CLÁUSULA QUARTA',
      'text', 'O aluguel será reajustado anualmente, de conformidade com a variação do {{reajuste_indice}}. Caso esse índice escolhido seja extinto, ou não seja apurado, será substituído pelos seguintes, nesta ordem de preferência: INPC ou IPCA, medidos pelo IBGE; IPC ou IGP, medidos pela Fundação Getúlio Vargas; índice de inflação medido pela Fundação Instituto de Pesquisas Econômicas; índice que for utilizado pelo Governo Federal para correção de tributos pagos com atraso; ou Taxa Referencial (TR).',
      'order', 4
    ),
    jsonb_build_object(
      'id', 'locacao-comercial-clausula-005',
      'title', 'CLÁUSULA QUINTA',
      'text', 'O LOCATÁRIO será responsável por todos os tributos incidentes sobre o imóvel, bem como despesas ordinárias de condomínio e quaisquer outras despesas que recaírem sobre o imóvel, arcando também com as despesas provenientes de sua utilização, sejam elas ligação e consumo de luz, água e gás, que serão pagas diretamente às empresas concessionárias dos referidos serviços, também taxas municipais, imposto territorial urbano e seguro contra fogo, devidos pelo imóvel locado individualmente.',
      'order', 5
    ),
    jsonb_build_object(
      'id', 'locacao-comercial-clausula-006',
      'title', 'CLÁUSULA SEXTA',
      'text', 'Em caso de atraso no pagamento do aluguel, será aplicada multa limitada a 10% (dez por cento) sobre o valor devido e juros mensais de 1% (um por cento) ao mês sobre o montante devido. Após 60 dias do vencimento, o título será encaminhado automaticamente a cartório/protesto.',
      'order', 6
    ),
    jsonb_build_object(
      'id', 'locacao-comercial-clausula-007',
      'title', 'CLÁUSULA SÉTIMA',
      'text', 'O LOCATÁRIO declara receber o imóvel em perfeito estado de conservação e perfeito funcionamento, devendo observar o que consta no termo de vistoria. Fica também ao LOCATÁRIO a responsabilidade em zelar pela conservação e limpeza do imóvel, efetuando as reformas necessárias para sua manutenção, sendo que os gastos e pagamentos decorrentes correrão por sua conta. O LOCATÁRIO obriga-se, na forma da lei, a devolver o imóvel em perfeitas condições de limpeza, conservação e pintura, quando finda ou rescindida esta avença, conforme constante no termo de vistoria em anexo. O LOCATÁRIO poderá realizar obras que alterem ou modifiquem a estrutura interna do imóvel locado somente com prévia autorização por escrito do LOCADOR. Caso este consinta na realização das obras, estas ficarão desde logo incorporadas ao imóvel, sem que assista ao LOCATÁRIO qualquer indenização pelas obras ou retenção por benfeitorias. As benfeitorias removíveis poderão ser retiradas, desde que não desfigurem o imóvel locado. PARÁGRAFO ÚNICO: O LOCATÁRIO declara que o imóvel ora locado destina-se única e exclusivamente ao uso COMERCIAL, obrigando-se por si e seus colaboradores a cumprir e fazer cumprir integralmente as disposições legais sobre o condomínio, sua convenção e seu regulamento interno.',
      'order', 7
    ),
    jsonb_build_object(
      'id', 'locacao-comercial-clausula-008',
      'title', 'CLÁUSULA OITAVA',
      'text', 'O LOCATÁRIO não poderá sublocar, transferir ou ceder o imóvel, sendo nulo de pleno direito qualquer ato praticado com este fim sem o consentimento prévio e por escrito do LOCADOR.',
      'order', 8
    ),
    jsonb_build_object(
      'id', 'locacao-comercial-clausula-009',
      'title', 'CLÁUSULA NONA',
      'text', 'Em caso de sinistro parcial ou total do prédio que impossibilite o uso do imóvel locado, o presente contrato estará rescindido, independentemente de aviso ou interpelação judicial ou extrajudicial; no caso de incêndio parcial, obrigando a obras de reconstrução, o presente contrato terá suspensa a sua vigência e reduzida a renda do imóvel durante o período da reconstrução à metade do que na época for o aluguel, sendo após a reconstrução devolvido o imóvel ao LOCATÁRIO pelo prazo restante do contrato, que ficará prorrogado pelo mesmo tempo de duração das obras de reconstrução.',
      'order', 9
    ),
    jsonb_build_object(
      'id', 'locacao-comercial-clausula-010',
      'title', 'CLÁUSULA DÉCIMA',
      'text', 'Em caso de desapropriação total ou parcial do imóvel locado, ficará rescindido de pleno direito o presente contrato de locação, independente de quaisquer indenizações entre as partes contratantes.',
      'order', 10
    ),
    jsonb_build_object(
      'id', 'locacao-comercial-clausula-011',
      'title', 'CLÁUSULA DÉCIMA PRIMEIRA',
      'text', 'Falecendo o FIADOR, o LOCATÁRIO deverá, no prazo de 15 (quinze) dias, apresentar substituto idôneo que possa garantir o valor locativo e encargos do referido imóvel, ou prestar seguro fiança de empresa idônea.',
      'order', 11
    ),
    jsonb_build_object(
      'id', 'locacao-comercial-clausula-012',
      'title', 'CLÁUSULA DÉCIMA SEGUNDA',
      'text', 'Na hipótese de o imóvel vir a ser colocado à venda, e após vencido o prazo de preferência do(a) LOCATÁRIO(a), obedecendo ao disposto no art. 27 e seguintes da Lei 8.245/91, este se obriga a fixar horário para visitas ao imóvel por interessados na compra. No caso desta modalidade não vir a ser respeitada, fica o(a) LOCATÁRIO(a) sujeito(a) à pena de pagamento de multa mensal de 20% (vinte por cento) do aluguel.',
      'order', 12
    ),
    jsonb_build_object(
      'id', 'locacao-comercial-clausula-013',
      'title', 'CLÁUSULA DÉCIMA TERCEIRA',
      'text', 'Assinam também o presente contrato, como FIADORES e principais pagadores solidariamente com o(a) LOCATÁRIO(a), por todas as obrigações contratuais decorrentes e aqui estabelecidas livremente, as pessoas indicadas no preâmbulo como FIADORES, cuja responsabilidade fidejussória é perdurável até a entrega real e efetiva das chaves do imóvel locado, e enquanto o(a) LOCATÁRIO(a) permanecer no mesmo imóvel, abrangendo as prorrogações e os reajustamentos que vierem a ocorrer. Da mesma forma, obrigam-se os FIADORES por todas as obrigações, se a locação permanecer por prazo indeterminado, renunciando expressamente ao benefício de ordem previsto no artigo 827 do Código Civil e aos benefícios dos artigos 835 e 838 do referido código. Os FIADORES outorgam também, através deste instrumento, poderes ao(à) LOCATÁRIO(a) para assinar em seu nome a vistoria de entrada e saída.',
      'order', 13
    ),
    jsonb_build_object(
      'id', 'locacao-comercial-clausula-014',
      'title', 'CLÁUSULA DÉCIMA QUARTA',
      'text', 'É facultado ao LOCADOR vistoriar, por si ou seus procuradores, sempre que achar conveniente, para a certeza do cumprimento das obrigações assumidas neste contrato.',
      'order', 14
    ),
    jsonb_build_object(
      'id', 'locacao-comercial-clausula-015',
      'title', 'CLÁUSULA DÉCIMA QUINTA',
      'text', 'A infração a qualquer das cláusulas do presente contrato sujeita o infrator à multa de duas vezes o valor do aluguel, tomando-se por base o último aluguel vencido.',
      'order', 15
    ),
    jsonb_build_object(
      'id', 'locacao-comercial-clausula-016',
      'title', 'CLÁUSULA DÉCIMA SEXTA',
      'text', 'Caso a ligação de energia já se encontre em funcionamento, deverá o(a) LOCATÁRIO(a) providenciar junto à concessionária de serviços públicos correspondente a transferência de titularidade da ligação, mediante a apresentação da cópia deste contrato de locação, comparecendo, em seguida, na sede da administradora, para comprovar a alteração. Deixando de tomar as providências previstas nesta cláusula, o(a) LOCATÁRIO(a), em caráter irrevogável e irretratável, outorga à administradora poderes para, querendo, sanar sua omissão, representando-o(a) perante as concessionárias de serviços públicos de água e energia elétrica, podendo incluir ou excluir o nome do(a) LOCATÁRIO(a) como responsável pelos pagamentos das tarifas advindas da utilização dos serviços fornecidos pelas referidas concessionárias, ficando a administradora também autorizada a lançar a débito do(a) LOCATÁRIO(a) os gastos que tenha tido para efetuar as diligências necessárias para a transferência de titularidade.',
      'order', 16
    ),
    jsonb_build_object(
      'id', 'locacao-comercial-clausula-017',
      'title', 'CLÁUSULA DÉCIMA SÉTIMA',
      'text', 'Tendo em vista as disposições da Lei do Inquilinato (Lei 8.245/91), fica estabelecido o seguinte: a) No caso de devolução do imóvel antes do prazo estipulado para o encerramento, fica pactuada multa a ser paga pelo(a) LOCATÁRIO(a), no valor de 30% (trinta por cento) do montante dos aluguéis vincendos até o final do prazo estipulado no contrato, calculado esse montante com base no aluguel que estiver em vigor por ocasião da devolução. Se a devolução ocorrer após o prazo previsto em contrato, não haverá pagamento de multa; b) Em caso de exoneração judicial do fiador, deverá o(a) LOCATÁRIO(a) substituí-lo no prazo de 7 (sete) dias por outro idôneo, a critério do LOCADOR, sob pena de infração contratual, passível de despejo; c) Na hipótese do art. 62, II, d, ficam fixados os honorários do advogado do LOCADOR em 20% (vinte por cento) sobre o valor da causa.',
      'order', 17
    ),
    jsonb_build_object(
      'id', 'locacao-comercial-clausula-018',
      'title', 'CLÁUSULA DÉCIMA OITAVA',
      'text', 'São ainda de responsabilidade do(a) LOCATÁRIO(a) o pagamento das seguintes despesas e encargos, juntamente com o aluguel mensal: a) encargos de limpeza, luz, água e saneamento individual; b) taxas municipais, imposto territorial e predial urbano e seguro contra fogo, devidos pelo imóvel locado individualmente; c) apresentação, no ato de pagamento mensal, da quitação da taxa de condomínio do mês, abrangendo: c.1) conservação, manutenção, limpeza, reparação e outras despesas desta ordem nas coisas comuns; c.2) prêmios de seguros do edifício proporcionalmente; c.3) impostos, taxas, emolumentos e quaisquer outros encargos que recaiam englobadamente sobre o edifício; c.4) ordenados de zeladores e empregados ou gratificações, bem como contribuições previdenciárias e demais encargos trabalhistas que vierem a contratar; c.5) consumo de energia elétrica para quaisquer aparelhos elétricos do prédio, bem como para iluminação das partes comuns do edifício; c.6) taxas de água, esgoto, lixo e outras que surgirem do prédio proporcionalmente; c.7) quaisquer outras imprevistas que digam respeito a despesas relacionadas com as partes comuns do edifício; c.8) despesas de que trata o parágrafo 1º do art. 23 da Lei 8.245/91, por força do disposto no parágrafo 3º do citado artigo; c.9) fica estabelecida multa de 10% (dez por cento), se o pagamento ocorrer após o prazo previsto no contrato de locação, incidindo sobre o valor da taxa e da multa correção monetária e juros calculados de acordo com a forma prevista na cláusula sexta.',
      'order', 18
    ),
    jsonb_build_object(
      'id', 'locacao-comercial-clausula-019',
      'title', 'CLÁUSULA DÉCIMA NONA',
      'text', 'Findo o prazo do contrato, o LOCATÁRIO terá preferência na renovação do contrato de locação, desde que tenha cumprido integralmente as obrigações contratuais, devendo manifestar interesse formal até 30 dias antes do término do contrato.',
      'order', 19
    ),
    jsonb_build_object(
      'id', 'locacao-comercial-clausula-020',
      'title', 'CLÁUSULA VIGÉSIMA',
      'text', 'As partes e as testemunhas envolvidas neste instrumento afirmam e declaram que este poderá ser assinado eletronicamente através de plataforma de assinatura digital, com fundamento no artigo 10, parágrafo 2º, da MP 2200-2/2001, e no artigo 6º do Decreto 10.278/2020, sendo as assinaturas consideradas válidas, vinculantes e executáveis, desde que firmadas pelos representantes legais das partes. Consigna-se no presente instrumento que a assinatura com certificado digital/eletrônica tem a mesma validade jurídica de um registro e autenticação feita em cartório, seja mediante utilização de certificados e-CPF, e-CNPJ e/ou NF-e. As partes renunciam à possibilidade de exigir a troca, envio ou entrega das vias originais não eletrônicas assinadas do instrumento, bem como renunciam ao direito de recusar ou contestar a validade das assinaturas eletrônicas, na medida máxima permitida pela legislação aplicável.',
      'order', 20
    )
  ) as clauses
)
update public.real_estate_contract_models
set
  clauses = commercial_rental_clauses.clauses,
  updated_at = now()
from commercial_rental_clauses
where contract_purpose = 'rental'
  and property_usage = 'commercial'
  and is_default = true;

notify pgrst, 'reload schema';
