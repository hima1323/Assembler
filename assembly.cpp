#include<iostream>
#include<fstream>
#include<sstream>
#include<string>
#include<vector>
#include<unordered_map>
#include<map>
#include<algorithm>
#include<iomanip>
#include<cstdint>
#include<cstdlib>
#include<cctype>
#include<stdexcept>
using namespace std;
int pn(string s){
    string t=s;
    if(!t.empty()&&t.back()==',')t.pop_back();
    if(t.size()==3&&t.front()=='\''&&t.back()=='\'')return(int)t[1];
    if(t.size()>2&&(t.rfind("0x",0)==0||t.rfind("0X",0)==0))return stoll(t.substr(2),nullptr,16);
    if(t.size()>2&&(t.rfind("0b",0)==0||t.rfind("0B",0)==0))return stoll(t.substr(2),nullptr,2);
    return stoll(t,nullptr,10);
}
string tr(string s){
    int a=s.find_first_not_of(" \t\r\n");
    if(a==string::npos)return "";
    int b=s.find_last_not_of(" \t\r\n");
    return s.substr(a,b-a+1);
}

vector<string> tk(string line){
    vector<string> toks;
    string cur;
    bool iq=false;
    char qc=0;
    for(int i=0;i<line.size();++i){
        char c=line[i];
        if((c=='\''||c=='\"')&&!iq){iq=true;qc=c;cur+=c;}
        else if(iq){cur+=c;if(c==qc){iq=false;toks.push_back(cur);cur.clear();}}
        else if(c==','||c==' '||c=='\t'){
            if(!cur.empty()){toks.push_back(cur);cur.clear();}
        }else if(c=='#')break;else cur+=c;
    }
    if(!cur.empty())toks.push_back(cur);
    return toks;
}
struct InstrDef{string name;string fmt;int opcode;int funct3;int funct7;};
unordered_map<string,InstrDef> instrs;

void init(){
    auto R=[&](string n,int opc,int f3,int f7){instrs[n]={n,"R",opc,f3,f7};};
    auto I=[&](string n,int opc,int f3,int f7=0){instrs[n]={n,"I",opc,f3,f7};};
    auto S=[&](string n,int opc,int f3){instrs[n]={n,"S",opc,f3,0};};
    auto SB=[&](string n,int opc,int f3){instrs[n]={n,"SB",opc,f3,0};};
    auto U=[&](string n,int opc){instrs[n]={n,"U",opc,0,0};};
    auto UJ=[&](string n,int opc){instrs[n]={n,"UJ",opc,0,0};};
    R("add",0x33,0x0,0x00);R("addw",0x3b,0x0,0x00);R("and",0x33,0x7,0x00);R("or",0x33,0x6,0x00);
    R("sll",0x33,0x1,0x00);R("slt",0x33,0x2,0x00);R("sra",0x33,0x5,0x20);R("srl",0x33,0x5,0x00);
    R("sub",0x33,0x0,0x20);R("subw",0x3b,0x0,0x20);R("xor",0x33,0x4,0x00);
    I("addi",0x13,0x0);I("addiw",0x1b,0x0);I("andi",0x13,0x7);I("ori",0x13,0x6);
    I("lb",0x03,0x0);I("ld",0x03,0x3);I("lh",0x03,0x1);I("lw",0x03,0x2);I("jalr",0x67,0x0);
    S("sb",0x23,0x0);S("sh",0x23,0x1);S("sw",0x23,2);S("sd",0x23,0x3);
    SB("beq",0x63,0x0);SB("bne",0x63,0x1);SB("bge",0x63,0x5);SB("blt",0x63,0x4);
    U("auipc",0x17);U("lui",0x37);
    UJ("jal",0x6f);
    I("ecall", 0x73, 0x0);
    R("mul",0x33,0x0,0x01);R("mulw",0x3b,0x0,0x01);R("div",0x33,0x4,0x01);R("divw",0x3b,0x4,0x01);
    R("rem",0x33,0x6,0x01);R("remw",0x3b,0x6,0x01);
}


int rg(string r){
    string s=r;
    if(!s.empty()&&s.back()==',')s.pop_back();
    if(s.size()>=2&&s[0]=='x')return stoi(s.substr(1));
    // This map now includes 'fp' as an alias for 's0' (register 8)
    static unordered_map<string,int> names={
        {"zero",0},{"ra",1},{"sp",2},{"gp",3},{"tp",4},{"t0",5},{"t1",6},{"t2",7},
        {"s0",8},{"fp",8},{"s1",9}, // <-- ADDED "fp" HERE
        {"a0",10},{"a1",11},{"a2",12},{"a3",13},{"a4",14},{"a5",15},{"a6",16},{"a7",17},
        {"s2",18},{"s3",19},{"s4",20},{"s5",21},{"s6",22},{"s7",23},{"s8",24},{"s9",25},
        {"s10",26},{"s11",27},{"t3",28},{"t4",29},{"t5",30},{"t6",31}
    };
    if(names.count(s))return names[s];
    return 0;
}
struct AsmLine{
    string raw;
    vector<string> toks;
    int addr=0;
    bool isInstr=false;
    string seg;
};

int pil(string s_in,unordered_map<string,int> &labelAddr){
    string t=s_in;
    if(!t.empty()&&t.back()==',')t.pop_back();
    if(!t.empty()&&(isdigit(t[0])||t[0]=='-')){
        try{
            return pn(t);
        }catch(...){}
    }
    if(labelAddr.count(t))return labelAddr.at(t);
    int hi_pos=t.find("%hi");
    if(hi_pos!=string::npos){
        int open_paren=t.find('(',hi_pos);
        int close_paren=t.find(')',open_paren);
        if(open_paren!=string::npos&&close_paren!=string::npos){
            string lbl=t.substr(open_paren+1,close_paren-open_paren-1);
            if(labelAddr.count(lbl)){
                int addr=labelAddr.at(lbl);
                return(addr+0x800)>>12;
            }
        }
    }
    int lo_pos=t.find("%lo");
    if(lo_pos!=string::npos){
        int open_paren=t.find('(',lo_pos);
        int close_paren=t.find(')',open_paren);
        if(open_paren!=string::npos&&close_paren!=string::npos){
            string lbl=t.substr(open_paren+1,close_paren-open_paren-1);
            if(labelAddr.count(lbl)){
                int addr=labelAddr.at(lbl);
                int imm=(int)(addr&0xFFF);
                if(imm&0x800)imm-=0x1000;
                return imm;
            }
        }
    }
    cerr<<"Error: Unresolved immediate or label '"<<t<<"'\n";
    return 0;
}

pair<int,int> pib(string s_in){
    string s=s_in;
    if(!s.empty()&&s.back()==',')s.pop_back();
    int open_paren=s.find('(');
    int close_paren=s.find(')');
    if(open_paren==string::npos||close_paren==string::npos||close_paren!=s.length()-1){
        throw runtime_error("Invalid imm(rs1) format: "+s_in);
    }
    string imm_str=s.substr(0,open_paren);
    string rs1_str=s.substr(open_paren+1,close_paren-open_paren-1);
    return{pn(imm_str),rg(rs1_str)};
}
int main(){
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    init();
    ifstream fin("input.asm");
    if(!fin){cerr<<"Cannot open input.asm\n";return 1;}
    vector<string> lines;string ln;while(getline(fin,ln))lines.push_back(ln);fin.close();
    unordered_map<string,int> labelAddr;
    vector<AsmLine> parsed;
    string curSeg="text";
    int pc_text=0x00000000;
    int pc_data=0x10000000;
    int curAddr=pc_text;
    for(auto &raw:lines){
        string s=tr(raw);
        if(s.empty())continue;
        int cpos=s.find('#');
        if(cpos!=string::npos)s=tr(s.substr(0,cpos));
        if(s.empty())continue;
        if(s.back()==':'){
            labelAddr[s.substr(0,s.size()-1)]=curAddr;
            continue;
        }
        auto toks=tk(s);
        if(toks.empty())continue;
        if(toks[0]==".text"){
            curSeg="text";
            curAddr=pc_text;
            continue;
        }
        if(toks[0]==".data"){
            curSeg="data";
            curAddr=pc_data;
            continue;
        }
        if(toks[0]==".align"){
            int align_bits=stoi(toks[1]);
            int align_bytes=1<<align_bits;
            curAddr=(curAddr+align_bytes-1)&~(align_bytes-1);
            if(curSeg=="text")pc_text=curAddr;
            else pc_data=curAddr;
            continue;
        }
        AsmLine al;
        al.raw=s;
        al.toks=toks;
        al.seg=curSeg;
        al.addr=curAddr;
        if(curSeg=="text"){
            al.isInstr=true;
            parsed.push_back(al);
            curAddr+=4;
            pc_text=curAddr;
        }else if(curSeg=="data"){
            al.isInstr=false;
            parsed.push_back(al);
            if(toks[0]==".word"){
                curAddr+=4*(toks.size()-1);
            }else if(toks[0]==".space"){
                curAddr+=pn(toks[1]);
            }else if(toks[0]==".string"||toks[0]==".asciiz"){
                string s_data=toks[1].substr(1,toks[1].size()-2);
                int len=s_data.length()+1;
                curAddr+=(len+3)&~3u;
            }
            pc_data=curAddr;
        }
    }
    ofstream fout("output.mc");
    if(!fout){cerr<<"Cannot open output.mc for writing\n";return 1;}
    for(auto &al:parsed){
        auto &toks=al.toks;
        string mnemonic=toks[0];
        try{
            if(al.seg=="text"){
                if(instrs.find(mnemonic)==instrs.end())continue;
                InstrDef def=instrs[mnemonic];
                int word=0;
                if(def.fmt=="R"){
                    int rd=rg(toks[1]);int rs1=rg(toks[2]);int rs2=rg(toks[3]);
                    word=((int)def.funct7<<25)|(rs2<<20)|(rs1<<15)|(def.funct3<<12)|(rd<<7)|(def.opcode);
                }
                else if(def.fmt=="I"){
                    int rd=0,rs1=0,imm=0;
                    // --- Special check for ecall --- no operands
                    if (mnemonic == "ecall") {
                        rd = 0; rs1 = 0; imm = 0;
                    }
                    // --- Load instructions use imm(rs1) syntax ---
                    else if(mnemonic=="lb"||mnemonic=="ld"||mnemonic=="lh"||mnemonic=="lw"){
                        rd=rg(toks[1]);
                        auto imm_base=pib(toks[2]);
                        imm=imm_base.first;
                        rs1=imm_base.second;
                    }
                    // --- jalr supports both rd, imm(rs1) and rd, rs1, imm ---
                    else if(mnemonic=="jalr"){
                        rd=rg(toks[1]);
                        if(toks.size()>=3 && toks[2].find('(')!=string::npos){
                            auto imm_base=pib(toks[2]);
                            imm=imm_base.first;
                            rs1=imm_base.second;
                        }else{
                            rs1=rg(toks[2]);
                            imm=pil(toks[3],labelAddr);
                        }
                    }
                    else{
                        rd=rg(toks[1]);
                        rs1=rg(toks[2]);
                        imm=pil(toks[3],labelAddr);
                    }
                    int uimm=(int)(imm&0xFFF);
                    word=(uimm<<20)|(rs1<<15)|(def.funct3<<12)|(rd<<7)|(def.opcode);
                }
                else if(def.fmt=="S"){
                    int rs2=rg(toks[1]);
                    auto imm_base=pib(toks[2]);
                    int imm=imm_base.first;
                    int rs1=imm_base.second;
                    int imm12=(int)(imm&0xFFF);
                    int imm11_5=(imm12>>5)&0x7F;
                    int imm4_0=imm12&0x1F;
                    word=(imm11_5<<25)|(rs2<<20)|(rs1<<15)|(def.funct3<<12)|(imm4_0<<7)|(def.opcode);
                }
                else if(def.fmt=="SB"){
                    int rs1=rg(toks[1]);int rs2=rg(toks[2]);string lbl=toks[3];
                    int offset=(int)labelAddr[lbl]-(int)al.addr;int imm=(int)offset;
                    // Correct RISC-V B-type encoding: imm[12|10:5] rs2 rs1 funct3 imm[4:1|11]
                    int bit12   = (imm >> 12) & 1;
                    int bits10_5= (imm >> 5)  & 0x3F;
                    int bits4_1 = (imm >> 1)  & 0xF;
                    int bit11   = (imm >> 11) & 1;
                    word=(bit12<<31)|(bits10_5<<25)|(rs2<<20)|(rs1<<15)|(def.funct3<<12)|(bits4_1<<8)|(bit11<<7)|(def.opcode);
                }
                else if(def.fmt=="U"){
                    int rd=rg(toks[1]);
                    int imm=pil(toks[2],labelAddr);
                    int imm20=(int)(imm&0xFFFFF);
                    word=(imm20<<12)|(rd<<7)|(def.opcode);
                }
                else if(def.fmt=="UJ"){
                    int rd=rg(toks[1]);string lbl=toks[2];
                    int offset=(int)labelAddr[lbl]-(int)al.addr;int imm=(int)offset;
                    // Correct RISC-V J-type encoding: imm[20|10:1|11|19:12]
                    int b20    = (imm >> 20) & 1;
                    int b10_1  = (imm >> 1)  & 0x3FF;
                    int b11    = (imm >> 11) & 1;
                    int b19_12 = (imm >> 12) & 0xFF;
                    word=(b20<<31)|(b10_1<<21)|(b11<<20)|(b19_12<<12)|(rd<<7)|(def.opcode);
                }
                fout<<"0x"<<hex<<al.addr<<" 0x"<<setw(8)<<setfill('0')<<hex<<word<<"\n";
            }else if(al.seg=="data"){}
        }catch(...){
            cerr<<"Error assembling line: "<<al.raw<<"\n";
            return 1;
        }
    }
    fout.close();
    cout<<"Assembling complete. output.mc written.\n";
    return 0;
}