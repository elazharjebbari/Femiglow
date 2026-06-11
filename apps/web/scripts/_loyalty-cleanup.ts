import postgres from 'postgres';
async function main(){const sql=postgres(process.env.DATABASE_URL!);const r=await sql`delete from coupon_grants where phone_e164 in ('+212612345699','+212612345678') returning code`;console.log('DELETED',r.map(x=>x.code).join(',')||'(none)');await sql.end();}
main().then(()=>process.exit(0)).catch(e=>{console.error('ERR',e.message);process.exit(1)});
